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
    if (digits.startsWith('0')) {
      digits = `${defaultCountryCode}${digits.slice(1)}`;
    } else if (digits.length === 9) {
      digits = `${defaultCountryCode}${digits}`;
    }
  }

  return digits;
};

export const getQuotePdfUrl = (quote: WhatsAppShareQuote) => (
  quote.pdfUrl || quote.quotePdfUrl || quote.publicPdfUrl || ''
).trim();

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

export const buildWhatsAppQuoteMessage = (quote: WhatsAppShareQuote, pdfUrl: string) => {
  const clientName = quote.clientName?.trim() || 'there';
  const businessName = quote.contractorBusinessName?.trim() || 'SoloBid';
  const reference = getQuoteShortReference(quote);
  const total = formatQuoteTotal(quote.total || 0, quote.currency || 'ZAR');
  const validity = formatQuoteValidity(quote);

  return [
    `Hi ${clientName},`,
    '',
    `Thank you for the opportunity. Please find ${reference} from ${businessName}.`,
    '',
    `Total amount (incl. VAT): ${total}`,
    `Validity: ${validity}`,
    `PDF quote: ${pdfUrl}`,
    '',
    'Please reply with ACCEPTED or let me know if you want any changes.',
    '',
    'Kind regards,'
  ].join('\n');
};

export function generateWhatsAppShareLink(quote: WhatsAppShareQuote): WhatsAppShareLinkResult {
  const phone = formatWhatsAppPhoneNumber(quote.clientPhone || quote.phone);

  if (!phone) {
    throw new Error('Add a client phone number before sharing this quote on WhatsApp. Use international format, e.g. +27 82 123 4567.');
  }

  if (phone.length < 10 || phone.length > 15) {
    throw new Error('The client phone number looks invalid. Please update it using international format, e.g. +27 82 123 4567.');
  }

  const pdfUrl = getQuotePdfUrl(quote);
  if (!pdfUrl) {
    throw new Error('No PDF link is available yet. Save the quote, then use Share on WhatsApp again so SoloBid can generate the PDF link.');
  }

  const message = buildWhatsAppQuoteMessage(quote, pdfUrl);

  return {
    href: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
    phone,
    message,
    pdfUrl,
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
