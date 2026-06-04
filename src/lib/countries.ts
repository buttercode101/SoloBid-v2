export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  taxRate: number;
  taxName: string;
  saTaxInvoiceMode?: boolean;
}

export const COUNTRIES: CountryConfig[] = [
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', taxRate: 15, taxName: 'VAT', saTaxInvoiceMode: true },
  { code: 'US', name: 'United States', currency: 'USD', taxRate: 0, taxName: 'Sales Tax' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', taxRate: 20, taxName: 'VAT' },
  { code: 'DE', name: 'Germany', currency: 'EUR', taxRate: 19, taxName: 'VAT (MwSt)' },
  { code: 'FR', name: 'France', currency: 'EUR', taxRate: 20, taxName: 'VAT (TVA)' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', taxRate: 23, taxName: 'VAT' },
  { code: 'IT', name: 'Italy', currency: 'EUR', taxRate: 22, taxName: 'VAT (IVA)' },
  { code: 'ES', name: 'Spain', currency: 'EUR', taxRate: 21, taxName: 'VAT (IVA)' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', taxRate: 21, taxName: 'VAT (BTW)' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', taxRate: 21, taxName: 'VAT (BTW)' },
  { code: 'AU', name: 'Australia', currency: 'AUD', taxRate: 10, taxName: 'GST' },
  { code: 'CA', name: 'Canada', currency: 'CAD', taxRate: 5, taxName: 'GST' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', taxRate: 15, taxName: 'GST' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', taxRate: 9, taxName: 'GST' },
];

export const getCountryByCode = (code: string): CountryConfig | undefined => {
  return COUNTRIES.find(c => c.code === code);
};

export const getCountryByCurrency = (currency: string): CountryConfig | undefined => {
  return COUNTRIES.find(c => c.currency === currency);
};
