import { format } from 'date-fns';
import { addBusinessDays, getNextBusinessDay, isPublicHoliday, isWeekend } from './integrations/holidays';
import { formatQuoteTotal } from './whatsapp';

export type QuotePaymentPlan = {
  total: number;
  currency?: string;
  depositPercent?: number;
  milestonePercent?: number;
  approvedAt?: string | null;
  dueBusinessDays?: number;
};

export type QuotePaymentPlanSummary = {
  depositAmount: number;
  balanceAmount: number;
  milestoneAmount: number;
  dueDate: Date;
  dueDateLabel: string;
  copy: string;
};

export async function getHolidayAwareExpiryDate(
  createdAt: string | Date,
  validityDays: string | number | null | undefined,
  countryCode = 'ZA',
): Promise<Date | null> {
  if (!validityDays || validityDays === 'never') return null;

  const days = typeof validityDays === 'number' ? validityDays : Number.parseInt(validityDays, 10);
  if (!Number.isFinite(days) || days <= 0) return null;

  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + days);

  if (isWeekend(expiry) || await isPublicHoliday(expiry, countryCode)) {
    return getNextBusinessDay(expiry, countryCode);
  }

  return expiry;
}

export async function getHolidayAwareInvoiceDueDate(
  startDate: string | Date,
  dueBusinessDays = 7,
  countryCode = 'ZA',
): Promise<Date> {
  return addBusinessDays(new Date(startDate), Math.max(1, dueBusinessDays), countryCode);
}

export async function buildQuotePaymentPlanSummary(plan: QuotePaymentPlan): Promise<QuotePaymentPlanSummary> {
  const currency = plan.currency || 'ZAR';
  const total = Math.max(0, Number(plan.total) || 0);
  const depositPercent = Math.min(100, Math.max(0, plan.depositPercent ?? 50));
  const milestonePercent = Math.min(100, Math.max(0, plan.milestonePercent ?? 0));

  const depositAmount = Number((total * (depositPercent / 100)).toFixed(2));
  const milestoneAmount = Number((total * (milestonePercent / 100)).toFixed(2));
  const balanceAmount = Number(Math.max(0, total - depositAmount).toFixed(2));
  const dueDate = await getHolidayAwareInvoiceDueDate(plan.approvedAt || new Date(), plan.dueBusinessDays ?? 7);
  const dueDateLabel = format(dueDate, 'd MMM yyyy');

  const copy = [
    `Deposit to start: ${formatQuoteTotal(depositAmount, currency)} (${depositPercent}%).`,
    `Balance after deposit: ${formatQuoteTotal(balanceAmount, currency)}.`,
    milestonePercent > 0 ? `Milestone value: ${formatQuoteTotal(milestoneAmount, currency)} (${milestonePercent}% progress).` : null,
    `Suggested payment due date: ${dueDateLabel} (adjusted to a business day when needed).`,
  ].filter(Boolean).join(' ');

  return {
    depositAmount,
    balanceAmount,
    milestoneAmount,
    dueDate,
    dueDateLabel,
    copy,
  };
}

export function buildPaymentReminderCopy(params: {
  businessName?: string;
  clientName?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  amountDue: number;
  currency?: string;
  dueDate?: string | Date | null;
  paymentReference?: string;
}) {
  const clientName = params.clientName?.trim() || 'there';
  const businessName = params.businessName?.trim() || 'SoloBid';
  const reference = params.invoiceNumber || params.quoteNumber || params.paymentReference || 'your invoice';
  const amount = formatQuoteTotal(params.amountDue, params.currency || 'ZAR');
  const due = params.dueDate ? ` Due date: ${format(new Date(params.dueDate), 'd MMM yyyy')}.` : '';

  return [
    `Hi ${clientName},`,
    '',
    `Friendly payment reminder from ${businessName} for ${reference}. Amount due: *${amount}*.${due}`,
    '',
    'Please send proof of payment here once paid. Thank you.',
  ].join('\n');
}
