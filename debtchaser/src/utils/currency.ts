/**
 * Format amount as currency string
 */
export const formatCurrency = (amount: number, currency: string): string => {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${currency}${safeAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Parse currency string to number
 */
export const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Validate currency amount
 */
export const isValidAmount = (amount: number, min: number = 0.01, max: number = 10_000_000): boolean => {
  return typeof amount === 'number' && !isNaN(amount) && amount >= min && amount <= max;
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

/**
 * Format large numbers with K, M, B suffixes
 */
export const formatLargeNumber = (num: number, currency: string = ''): string => {
  const absNum = Math.abs(num);
  
  if (absNum >= 1_000_000_000) {
    return `${currency}${(num / 1_000_000_000).toFixed(1)}B`;
  } else if (absNum >= 1_000_000) {
    return `${currency}${(num / 1_000_000).toFixed(1)}M`;
  } else if (absNum >= 1_000) {
    return `${currency}${(num / 1_000).toFixed(1)}K`;
  } else {
    return formatCurrency(num, currency);
  }
};

/**
 * Calculate total from array of amounts
 */
export const sumAmounts = (amounts: number[]): number => {
  return amounts.reduce((sum, amount) => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return sum + safeAmount;
  }, 0);
};

/**
 * Calculate average from array of amounts
 */
export const averageAmount = (amounts: number[]): number => {
  if (amounts.length === 0) return 0;
  return sumAmounts(amounts) / amounts.length;
};
