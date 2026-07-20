import { Invoice, Settings } from '../types';
import { formatCurrency, formatDate } from '../utils';

/**
 * Export invoices to CSV format
 */
export const exportInvoicesToCSV = (invoices: Invoice[], currency: string): void => {
  if (invoices.length === 0) {
    alert('No invoices to export.');
    return;
  }

  const headers = [
    'ID',
    'Client Name',
    'Amount',
    'Due Date',
    'Status',
    'Reminders Sent',
    'Created At',
    'Paid Date',
    'Payment Method',
    'Payment Notes'
  ];

  const rows = invoices.map(invoice => [
    invoice.id,
    `"${(invoice.clientName || '').replace(/"/g, '""')}"`,
    invoice.amount.toFixed(2),
    invoice.dueDate,
    invoice.status,
    invoice.remindersSent,
    invoice.createdAt,
    invoice.paidDate || '',
    invoice.paymentMethod || '',
    `"${(invoice.paymentNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  downloadFile(
    csvContent,
    `debt_chaser_export_${new Date().toISOString().split('T')[0]}.csv`,
    'text/csv;charset=utf-8'
  );
};

/**
 * Export all data as JSON
 */
export const exportDataToJSON = (invoices: Invoice[], settings: Settings): void => {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    settings,
    invoices,
    summary: {
      totalInvoices: invoices.length,
      paidCount: invoices.filter(inv => inv.status === 'paid').length,
      overdueCount: invoices.filter(inv => inv.status === 'overdue').length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
      recoveredAmount: invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + inv.amount, 0),
    }
  };

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(
    jsonContent,
    `debt_chaser_backup_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
};

/**
 * Download file to user's device
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Import invoices from JSON file
 */
export const importInvoicesFromJSON = (file: File): Promise<Invoice[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (!Array.isArray(data.invoices) && !Array.isArray(data)) {
          throw new Error('Invalid file format: expected invoices array');
        }

        const invoices = Array.isArray(data) ? data : data.invoices;
        
        // Validate and sanitize invoices
        const validatedInvoices = invoices.map((inv: any) => validateImportedInvoice(inv));
        resolve(validatedInvoices);
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Validate imported invoice data
 */
const validateImportedInvoice = (data: any): Invoice => {
  const now = new Date().toISOString();
  
  return {
    id: Number(data.id) || Date.now() + Math.random(),
    clientName: String(data.clientName || 'Unknown Client'),
    amount: Number(data.amount) || 0,
    dueDate: data.dueDate || now,
    clientPhone: String(data.clientPhone || ''),
    invoiceNumber: String(data.invoiceNumber || ''),
    status: ['overdue', 'pending', 'upcoming', 'paid', 'disputed'].includes(data.status)
      ? data.status
      : 'upcoming',
    remindersSent: Number(data.remindersSent) || 0,
    messages: Array.isArray(data.messages) ? data.messages : [],
    createdAt: data.createdAt || now,
    paidDate: data.paidDate,
    paidAmount: data.paidAmount,
    paymentMethod: data.paymentMethod,
    paymentNotes: data.paymentNotes,
    lastReminder: data.lastReminder,
  };
};

/**
 * Print invoice as receipt
 */
export const printInvoice = (invoice: Invoice, settings: Settings): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print invoices');
    return;
  }

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice ${invoice.invoiceNumber || invoice.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .company { font-size: 24px; font-weight: bold; }
        .invoice-details { margin: 20px 0; }
        .client-info { margin: 20px 0; }
        .amount { font-size: 32px; font-weight: bold; color: #1e40af; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .status-overdue { background: #fee2e2; color: #dc2626; }
        .status-pending { background: #fef3c7; color: #d97706; }
        .status-upcoming { background: #dbeafe; color: #2563eb; }
        .status-paid { background: #d1fae5; color: #059669; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
        .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${settings.businessName}</div>
        <div>Payment Reminder</div>
      </div>
      
      <div class="invoice-details">
        <div><strong>Invoice #:</strong> ${invoice.invoiceNumber || invoice.id}</div>
        <div><strong>Date:</strong> ${formatDate(invoice.createdAt)}</div>
        <div><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</div>
        <div><strong>Status:</strong> <span class="status status-${invoice.status}">${invoice.status}</span></div>
      </div>

      <div class="client-info">
        <div><strong>Client:</strong> ${invoice.clientName}</div>
        <div><strong>Phone:</strong> ${invoice.clientPhone || 'N/A'}</div>
      </div>

      <div style="margin: 30px 0;">
        <div class="amount">${formatCurrency(invoice.amount, settings.currency)}</div>
      </div>

      ${invoice.messages.length > 0 ? `
        <div style="margin: 30px 0;">
          <h3>Reminder History</h3>
          <table>
            <tr><th>Date</th><th>Type</th><th>Sent</th></tr>
            ${invoice.messages.map(msg => `
              <tr>
                <td>${formatDate(msg.date)}</td>
                <td>${msg.type}</td>
                <td>${msg.sent ? '✓' : 'No'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}

      ${invoice.status === 'paid' && invoice.paidDate ? `
        <div style="margin: 30px 0; padding: 20px; background: #d1fae5; border-radius: 8px;">
          <strong>✓ Paid on ${formatDate(invoice.paidDate)}</strong>
          ${invoice.paymentMethod ? `<div>Method: ${invoice.paymentMethod}</div>` : ''}
          ${invoice.paymentNotes ? `<div>Notes: ${invoice.paymentNotes}</div>` : ''}
        </div>
      ` : ''}

      <div class="footer">
        <div>Generated by DebtChaser</div>
        <div>${new Date().toLocaleString()}</div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(printContent);
  printWindow.document.close();
};

/**
 * Generate shareable invoice summary
 */
export const generateInvoiceSummary = (invoices: Invoice[], settings: Settings): string => {
  const total = invoices.length;
  const paid = invoices.filter(inv => inv.status === 'paid').length;
  const overdue = invoices.filter(inv => inv.status === 'overdue').length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const recoveredAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return `
📊 DebtChaser Summary
━━━━━━━━━━━━━━━━━━━━
Total Invoices: ${total}
Paid: ${paid} (${Math.round((paid / total) * 100)}%)
Overdue: ${overdue}

💰 Financial Summary
━━━━━━━━━━━━━━━━━━━━
Total: ${formatCurrency(totalAmount, settings.currency)}
Recovered: ${formatCurrency(recoveredAmount, settings.currency)}
Outstanding: ${formatCurrency(totalAmount - recoveredAmount, settings.currency)}

Generated: ${new Date().toLocaleString()}
  `.trim();
};
