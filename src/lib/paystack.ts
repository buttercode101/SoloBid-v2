// Paystack inline JS integration — no npm package needed, uses their CDN script.
// Disabled by default while provider approval is pending.

const PAYSTACK_ENABLED = import.meta.env.VITE_PAYSTACK_ENABLED === 'true';

declare global {
  interface Window {
    PaystackPop: {
      setup(config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, any>;
        onClose: () => void;
        callback: (response: { reference: string; status: string }) => void;
      }): { openIframe(): void };
    };
  }
}

function assertPaystackEnabled(): void {
  if (!PAYSTACK_ENABLED) {
    throw new Error('Online payments are disabled while approval is pending. Use manual payment tracking for now.');
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(script);
  });
}

export async function initializePaystackPayment(params: {
  email: string;
  amountZAR: number;
  reference: string;
  invoiceId: string;
  publicKey: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}): Promise<void> {
  assertPaystackEnabled();
  await loadPaystackScript();
  const handler = window.PaystackPop.setup({
    key: params.publicKey,
    email: params.email,
    amount: Math.round(params.amountZAR * 100),
    currency: 'ZAR',
    ref: params.reference,
    metadata: { invoiceId: params.invoiceId },
    onClose: params.onClose,
    callback: (response) => {
      if (response.status === 'success') {
        params.onSuccess(response.reference);
      }
    },
  });
  handler.openIframe();
}

export function generatePaymentReference(invoiceNumber: string): string {
  return `SB-${invoiceNumber}-${Date.now()}`;
}
