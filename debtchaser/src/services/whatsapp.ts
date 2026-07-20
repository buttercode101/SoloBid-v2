import { Invoice } from '../types';
import { formatMessage } from '../utils';

/**
 * Format phone number for WhatsApp (South Africa format)
 */
export const formatPhoneForWhatsApp = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle various phone number formats
  if (cleaned.startsWith('+')) {
    // Already has country code, remove +
    cleaned = cleaned.substring(1);
  }
  
  // If it starts with '0' and is 10 digits (South Africa local format), replace with '27'
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '27' + cleaned.substring(1);
  }
  
  // If it starts with '27' and is 11 digits, it's correct
  // If it's just 9 digits (without country code), add 27
  if (cleaned.length === 9) {
    cleaned = '27' + cleaned;
  }
  
  return cleaned;
};

/**
 * Create WhatsApp URL with pre-filled message
 */
export const createWhatsAppUrl = (phone: string, message: string): string => {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

/**
 * Create SMS URL with pre-filled message
 */
export const createSmsUrl = (phone: string, message: string): string => {
  // Detect iOS for correct SMS separator
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? '&' : '?';
  return `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
};

/**
 * Share via native share API if available
 */
export const nativeShare = async (title: string, text: string, url?: string): Promise<void> => {
  if (!navigator.share) {
    throw new Error('Native share not supported');
  }

  await navigator.share({
    title,
    text,
    url
  });
};

/**
 * Check if native share is supported
 */
export const isNativeShareSupported = (): boolean => {
  return 'share' in navigator;
};

/**
 * Check if WhatsApp is available (web)
 */
export const isWhatsAppAvailable = (): boolean => {
  return true; // WhatsApp Web is always available via URL
};

/**
 * Handle sharing invoice reminder
 */
export interface ShareOptions {
  invoice: Invoice;
  currency: string;
  channel: 'whatsapp' | 'sms' | 'native' | 'copy';
}

export const shareReminder = async (options: ShareOptions): Promise<{ success: boolean; url?: string; channel?: string }> => {
  const { invoice, currency, channel } = options;
  const message = formatMessage(invoice, currency);
  const phone = invoice.clientPhone;

  try {
    switch (channel) {
      case 'native':
        if (isNativeShareSupported()) {
          await nativeShare(
            `Payment Reminder: ${invoice.invoiceNumber || invoice.id}`,
            message
          );
          return { success: true };
        }
        // Fallback to copy
        await navigator.clipboard.writeText(message);
        return { success: true, channel: 'copy' };

      case 'whatsapp':
        const whatsappUrl = createWhatsAppUrl(phone, message);
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        return { success: true, url: whatsappUrl };

      case 'sms':
        const smsUrl = createSmsUrl(phone, message);
        window.open(smsUrl, '_self');
        return { success: true, url: smsUrl };

      case 'copy':
      default:
        await navigator.clipboard.writeText(message);
        return { success: true };
    }
  } catch (error) {
    console.error('Share failed:', error);
    // Fallback to copy
    try {
      await navigator.clipboard.writeText(message);
      return { success: true };
    } catch (clipboardError) {
      console.error('Clipboard fallback also failed:', clipboardError);
      return { success: false };
    }
  }
};

/**
 * Copy message to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Clipboard access failed:', error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      console.error('All copy methods failed:', fallbackError);
      return false;
    }
  }
};

/**
 * Get share channels availability
 */
export const getAvailableChannels = (): { channel: string; available: boolean }[] => {
  return [
    { channel: 'whatsapp', available: isWhatsAppAvailable() },
    { channel: 'sms', available: true },
    { channel: 'native', available: isNativeShareSupported() },
    { channel: 'copy', available: true },
  ];
};
