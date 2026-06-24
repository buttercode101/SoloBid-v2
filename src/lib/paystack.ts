// Paystack inline JS integration — no npm package needed, uses their CDN script.
// Paystack is reserved for SoloBid user subscription billing.
// Contractor/client invoice payments are not supported in SoloBid launch mode.

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
    throw new Error('Subscription payments are disabled while Paystack approval is pending.');
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

export async function initializeSubscriptionCheckout(params: {
  email: string;
  amountZAR: number;
  reference: string;
  planId: string;
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
    metadata: {
      billingType: 'subscription',
      planId: params.planId,
    },
    onClose: params.onClose,
    callback: (response) => {
      if (response.status === 'success') {
        params.onSuccess(response.reference);
      }
    },
  });
  handler.openIframe();
}

// Legacy compatibility export for old invoice-level code paths.
// Do not use this for contractor/client invoices.
export async function initializePaystackPayment(): Promise<void> {
  throw new Error('Paystack is reserved for SoloBid subscriptions, not contractor invoice payments. Use manual invoice payment tracking.');
}

export function generateSubscriptionReference(planId: string): string {
  return `SB-SUB-${planId}-${Date.now()}`;
}

// Legacy compatibility export for old invoice-level code paths.
export function generatePaymentReference(invoiceNumber: string): string {
  return `SB-LEGACY-${invoiceNumber}-${Date.now()}`;
}
