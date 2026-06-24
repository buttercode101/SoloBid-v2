function normalizeSouthAfricanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0')) return `27${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalizedPhone = normalizeSouthAfricanPhone(phone);
  const encodedMessage = encodeURIComponent(message.trim());
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

export function buildQuoteShareMessage(params: {
  businessName: string;
  clientName?: string;
  quoteNumber?: string;
  total?: string;
  link: string;
}): string {
  const greeting = params.clientName ? `Hi ${params.clientName},` : 'Hi,';
  const quoteLabel = params.quoteNumber ? `quote ${params.quoteNumber}` : 'your quote';
  const totalText = params.total ? ` Total: ${params.total}.` : '';
  return `${greeting} ${params.businessName} has sent ${quoteLabel}.${totalText} View it here: ${params.link}`;
}

export function buildPaymentReminderMessage(params: {
  businessName: string;
  clientName?: string;
  invoiceNumber?: string;
  amountDue?: string;
  dueDate?: string;
  paymentLink?: string;
}): string {
  const greeting = params.clientName ? `Hi ${params.clientName},` : 'Hi,';
  const invoiceLabel = params.invoiceNumber ? `invoice ${params.invoiceNumber}` : 'your invoice';
  const amountText = params.amountDue ? ` Amount due: ${params.amountDue}.` : '';
  const dueText = params.dueDate ? ` Due date: ${params.dueDate}.` : '';
  const linkText = params.paymentLink ? ` Payment link: ${params.paymentLink}` : '';
  return `${greeting} friendly reminder from ${params.businessName} about ${invoiceLabel}.${amountText}${dueText}${linkText}`;
}
