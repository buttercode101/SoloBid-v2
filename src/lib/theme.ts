// Premium Design Tokens & Utilities in line with Apple design philosophies.

export const theme = {
  colors: {
    primary: '#04473e',      // Dark Forest/Pine Green
    primaryHover: '#03362f', // Slightly darker forest green
    success: '#045e43',      // Darker emerald/success green
    neutralBg: '#FAFAFA',    // Warm off-white page background
    cardBg: '#FFFFFF',       // Card white
    slate: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      550: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    }
  },
  radius: {
    card: 'rounded-3xl',        // rounded-[24px] for extreme premium feel
    inner: 'rounded-2xl',       // rounded-[16px] for nested elements
    button: 'rounded-xl',       // rounded-[12px]
    badge: 'rounded-full',      // rounded-full
  },
  shadow: {
    soft: 'shadow-[0_4px_20px_0_rgba(0,0,0,0.03)]',
    card: 'shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300',
    button: 'active:scale-[0.985] transition-all duration-200',
  },
  transition: 'transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)',
};

/**
 * Formats a number as ZAR currency: e.g. 6767.75 -> "R6 767,75"
 */
export function formatZAR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'R0,00';
  }
  const rounded = (Math.round(amount * 100) / 100).toFixed(2);
  const [integerPart, decimalPart] = rounded.split('.');
  
  // Format integer with spaces as thousand separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  return `R${formattedInteger},${decimalPart}`;
}

/**
 * Standard colors for Status Badges
 */
export const statusBadgeStyles = {
  sent: 'bg-blue-50 text-blue-700 border border-blue-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  converted: 'bg-violet-50 text-violet-700 border border-violet-100',
  draft: 'bg-zinc-100 text-zinc-650 border border-zinc-200',
  paid: 'bg-teal-50 text-teal-700 border border-teal-100',
  overdue: 'bg-red-50 text-red-700 border border-red-100',
  rejected: 'bg-red-50 text-red-700 border border-red-100',
  request_revision: 'bg-amber-50 text-amber-700 border border-amber-100',
};
