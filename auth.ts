export const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case 'ZAR': return 'R';
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'AUD': return 'A$';
    case 'CAD': return 'C$';
    case 'NZD': return 'NZ$';
    case 'SGD': return 'S$';
    default: return '$';
  }
};
