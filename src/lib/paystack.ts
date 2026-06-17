// Paystack inline JS integration — no npm package needed, uses their CDN script

declare global {
  interface Window {
    PaystackPop: {
      setup(config: {
        key: string;
        email: string;
        amount: number; // in kobo/cents (multiply ZAR by 100)
        currency: string;
        ref: string;
        metadata?: Record<string, any>;
        onClose: () => void;
        callback: (response: { reference: string; status: string }) => void;
      }): { openIframe(): void };
    };
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
  await loadPaystackScript();
  const handler = window.PaystackPop.setup({
    key: params.publicKey,
    email: params.email,
    amount: Math.round(params.amountZAR * 100), // convert to cents
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
