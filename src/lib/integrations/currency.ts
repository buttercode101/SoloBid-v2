export type ExchangeRatesResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

const rateCache = new Map<string, ExchangeRatesResponse>();

export async function getExchangeRates(base = 'ZAR', symbols: string[] = ['USD', 'EUR', 'GBP']): Promise<ExchangeRatesResponse> {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()).filter(Boolean)));
  const cacheKey = `${base.toUpperCase()}:${uniqueSymbols.sort().join(',')}`;
  const cached = rateCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    from: base.toUpperCase(),
    to: uniqueSymbols.join(','),
  });

  const response = await fetch(`https://api.frankfurter.app/latest?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Could not load exchange rates.');
  }

  const rates = (await response.json()) as ExchangeRatesResponse;
  rateCache.set(cacheKey, rates);
  return rates;
}

export async function convertCurrency(amount: number, from = 'ZAR', to = 'USD'): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const rates = await getExchangeRates(from, [to]);
  const rate = rates.rates[to.toUpperCase()];
  if (!rate) throw new Error(`No exchange rate found for ${from} to ${to}.`);
  return Number((amount * rate).toFixed(2));
}

export function formatCurrency(amount: number, currency = 'ZAR', locale = 'en-ZA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
