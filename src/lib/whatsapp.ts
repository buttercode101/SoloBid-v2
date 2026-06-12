import { format } from 'date-fns';
import { getCurrencySymbol } from './currencies';
import { formatZAR } from './theme';

export type WhatsAppShareQuote = {
  id?: string;
  clientName?: string;
  clientPhone?: string;
  phone?: string;
  total?: number;
  currency?: string;
  expiresAt?: string | null;
  validityDays?: string | number | null;
  pdfUrl?: string;
  quotePdfUrl?: string;
  publicPdfUrl?: string;
  description?: string;
  notes?: string;
  lineItems?: Array<{ description?: string }>;
  contractorBusinessName?: string;
};

export type WhatsAppShareLinkResult = {
  href: string;
  phone: string;
  message: string;
  pdfUrl: string;
};

const DEFAULT_COUNTRY_CODE = '27';

export const formatWhatsAppPhoneNumber = (phone?: string, defaultCountryCode = DEFAULT_COUNTRY_CODE) => {
  const raw = (phone || '').trim();
  if (!raw) return '';

  const hadPlus = raw.startsWith('+');
  const hadInternationalPrefix = raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');

  if (hadInternationalPrefix) {
    digits = digits.replace(/^00/, '');
  } else if (!hadPlus) {
    // SoloBid currently guides South African numbers. Convert 082... or 82... to 2782... for wa.me.
    if (digits.startsWith('0')) {
      digits = `${defaultCountryCode}${digits.slice(1)}`;
    } else if (digits.length === 9) {
      digits = `${defaultCountryCode}${digits}`;
    }
  }

  return digits;
};

export const validateWhatsAppPhoneNumber = (phone: string) => {
  if (!phone) {
    throw new Error('Add a client WhatsApp number before sharing, e.g. 082 123 4567 or +27 82 123 4567.');
  }

  // Accept any international number: 7–15 digits after country code
  if (!/^\d{7,15}$/.test(phone)) {
    throw new Error('The client WhatsApp number looks invalid. Use a local SA number like 082 123 4567 or an international format like +27 82 123 4567.');
  }
};

export const getQuotePdfUrl = (quote: WhatsAppShareQuote) => (
  quote.pdfUrl || quote.quotePdfUrl || quote.publicPdfUrl || ''
).trim();

export const validateQuotePdfUrl = (pdfUrl: string) => {
  try {
    const parsedUrl = new URL(pdfUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported PDF URL protocol');
  } catch {
    throw new Error('The quote PDF link is invalid. Please regenerate the PDF and try sharing again.');
  }
};

export const getQuoteShortReference = (quote: WhatsAppShareQuote) => {
  const reference = quote.id && quote.id !== 'draft' ? `Quote #${quote.id.slice(0, 8).toUpperCase()}` : 'your quote';
  const description = quote.description || quote.lineItems?.find(item => item.description?.trim())?.description || quote.notes;
  if (!description) return reference;
  return `${reference} - ${description.trim().slice(0, 90)}`;
};

export const formatQuoteTotal = (amount = 0, currency = 'ZAR') => {
  if (currency === 'ZAR') return formatZAR(amount);
  return `${getCurrencySymbol(currency)}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatQuoteValidity = (quote: WhatsAppShareQuote) => {
  if (quote.expiresAt) return `valid until ${format(new Date(quote.expiresAt), 'd MMM yyyy')}`;
  if (quote.validityDays === 'never') return 'valid until further notice';
  if (quote.validityDays) return `valid for ${quote.validityDays} day${String(quote.validityDays) === '1' ? '' : 's'}`;
  return 'valid for the stated quote period';
};

export const buildWhatsAppQuoteMessage = (quote: WhatsAppShareQuote, viewUrl: string) => {
  const clientName = quote.clientName?.trim() || 'there';
  const businessName = quote.contractorBusinessName?.trim() || 'your contractor';
  const total = formatQuoteTotal(quote.total || 0, quote.currency || 'ZAR');
  const validity = formatQuoteValidity(quote);

  return [
    `Hi ${clientName},`,
    '',
    `${businessName} has sent you a quotation for *${total}* (${validity}).`,
    '',
    `Tap to view, approve or decline:`,
    viewUrl,
    '',
    'Reply here if you have any questions.'
  ].join('\n');
};

export function generateWhatsAppShareLink(quote: WhatsAppShareQuote, clientViewBaseUrl?: string): WhatsAppShareLinkResult {
  const phone = formatWhatsAppPhoneNumber(quote.clientPhone || quote.phone);

  validateWhatsAppPhoneNumber(phone);

  // Prefer the interactive client view link so clients can approve/sign on their phone.
  // Fall back to a PDF link if available, or raise an error if neither exists.
  let viewUrl = '';
  if (clientViewBaseUrl && quote.id && quote.id !== 'draft') {
    viewUrl = `${clientViewBaseUrl}/client/quote/${quote.id}`;
  } else {
    const pdfUrl = getQuotePdfUrl(quote);
    if (!pdfUrl) {
      throw new Error('Save the quote first so SoloBid can generate a shareable link.');
    }
    validateQuotePdfUrl(pdfUrl);
    viewUrl = pdfUrl;
  }

  const message = buildWhatsAppQuoteMessage(quote, viewUrl);

  return {
    href: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    phone,
    message,
    pdfUrl: viewUrl,
  };
}

export const trackWhatsAppShare = (quoteId?: string, source = 'quote') => {
  const eventName = 'whatsapp_quote_share_triggered';
  const payload = { quoteId, source, timestamp: new Date().toISOString() };

  if (typeof window === 'undefined') return;

  if (typeof (window as any).gtag === 'function') {
    (window as any).gtag('event', eventName, payload);
  }

  window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
};
