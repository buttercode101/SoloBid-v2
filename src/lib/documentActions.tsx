import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { QuotePDF } from '../components/QuotePDF';
import { InvoicePDF } from '../components/InvoicePDF';

async function generateEftQrDataUrl(
  bankName: string,
  accountNumber: string,
  branchCode: string | undefined,
  invoiceNumber: string,
  total: number
): Promise<string | undefined> {
  try {
    const text = `Bank: ${bankName}\nAccount: ${accountNumber}\nBranch: ${branchCode || ''}\nRef: ${invoiceNumber}\nAmount: R${total.toFixed(2)}`;
    return await QRCode.toDataURL(text, { width: 200, margin: 1 });
  } catch {
    return undefined;
  }
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export async function buildQuotePdfBlob(quote: any, contractor: any, lineItems: any[]) {
  if (contractor?.saTaxInvoiceMode && (quote.total || 0) >= 5000 && !quote.clientAddress) {
    console.warn('[buildQuotePdfBlob] SA Tax Invoice mode is active and total >= 5000 but clientAddress is missing for recipient details.');
  }
  return pdf(
    <QuotePDF
      quote={quote}
      contractor={contractor}
      lineItems={lineItems}
      contractorVatNumber={contractor?.vatNumber}
      contractorRegNumber={contractor?.businessRegistrationNumber}
      clientVatNumber={quote.clientVatNumber}
    />
  ).toBlob();
}

export async function buildInvoicePdfBlob(invoice: any, estimate: any, contractor: any, lineItems: any[]) {
  if (contractor?.saTaxInvoiceMode && (invoice.total || 0) >= 5000 && !invoice.clientAddress) {
    console.warn('[buildInvoicePdfBlob] SA Tax Invoice mode is active and total >= 5000 but clientAddress is missing for recipient details.');
  }

  let qrDataUrl: string | undefined;
  const bankName: string | undefined = contractor?.bankName;
  const accountNumber: string | undefined = contractor?.accountNumber;
  const branchCode: string | undefined = contractor?.branchCode;
  const needsQr = (invoice.status === 'sent' || invoice.status === 'overdue') && bankName && accountNumber;
  if (needsQr) {
    const invoiceNum = invoice.invoiceNumber || invoice.id?.substring(0, 8).toUpperCase() || '';
    qrDataUrl = await generateEftQrDataUrl(bankName!, accountNumber!, branchCode, invoiceNum, invoice.total || 0);
  }

  return pdf(
    <InvoicePDF
      invoice={invoice}
      estimate={estimate}
      contractor={contractor}
      lineItems={lineItems}
      contractorVatNumber={contractor?.vatNumber}
      contractorRegNumber={contractor?.businessRegistrationNumber}
      clientVatNumber={invoice.clientVatNumber}
      bankName={bankName}
      accountNumber={accountNumber}
      branchCode={branchCode}
      qrDataUrl={qrDataUrl}
    />
  ).toBlob();
}

export async function downloadQuotePdf(quote: any, contractor: any, lineItems: any[]) {
  const blob = await buildQuotePdfBlob(quote, contractor, lineItems);
  downloadBlob(blob, `Quote_${(quote.id || 'draft').substring(0, 8).toUpperCase()}.pdf`);
}

export async function sharePdfViaWhatsApp(blob: Blob, filename: string, text: string, url?: string) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const shareData: ShareData = { title: filename, text, files: [file] };
  if (navigator.canShare?.(shareData) && navigator.share) {
    await navigator.share(shareData);
    return;
  }
  if (navigator.share) {
    await navigator.share({ title: filename, text, url });
    return;
  }
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}${url ? ` ${url}` : ''}`)}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  toast.info('WhatsApp opened with your message. Attach the downloaded PDF if needed.');
}
