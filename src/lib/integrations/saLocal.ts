export function normalizeSouthAfricanMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27')) return `+${digits}`;
  if (digits.startsWith('0')) return `+27${digits.slice(1)}`;
  return phone.trim();
}

export function isLikelySouthAfricanMobile(phone: string): boolean {
  return /^\+27[6-8][0-9]{8}$/.test(normalizeSouthAfricanMobile(phone));
}

export function isLikelySouthAfricanVatNumber(vatNumber: string): boolean {
  return /^4\d{9}$/.test(vatNumber.replace(/\D/g, ''));
}

export function getDefaultSaBusinessSettings() {
  return {
    country: 'ZA',
    currency: 'ZAR',
    locale: 'en-ZA',
    defaultVatRate: 15,
    invoiceTerms: 'Payment is due within 7 days unless otherwise agreed in writing.',
  } as const;
}

export function formatSaDate(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(value);
}
