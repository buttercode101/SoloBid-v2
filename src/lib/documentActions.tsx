import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { QuotePDF } from '../components/QuotePDF';
import { InvoicePDF } from '../components/InvoicePDF';

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
  return pdf(<QuotePDF quote={quote} contractor={contractor} lineItems={lineItems} />).toBlob();
}

export async function buildInvoicePdfBlob(invoice: any, estimate: any, contractor: any, lineItems: any[]) {
  return pdf(<InvoicePDF invoice={invoice} estimate={estimate} contractor={contractor} lineItems={lineItems} />).toBlob();
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
