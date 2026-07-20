import { useMemo } from 'react';
import { Invoice, Analytics } from '../types';
import { safeDate } from '../utils/date';

export interface UseAnalyticsReturn {
  analytics: Analytics;
  isLoading: boolean;
}

export const useAnalytics = (invoices: Invoice[]): UseAnalyticsReturn => {
  const analytics = useMemo<Analytics>(() => {
    if (!invoices || invoices.length === 0) {
      return {
        totalRecovered: 0,
        totalOutstanding: 0,
        overdueAmount: 0,
        thisMonthRecovered: 0,
        averageDaysToPayment: 0,
        successRate: 0,
      };
    }

    const now = new Date();
    
    // Total recovered (paid invoices)
    const totalRecovered = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (typeof inv.amount === 'number' ? inv.amount : 0), 0);

    // Total outstanding (unpaid invoices)
    const totalOutstanding = invoices
      .filter(inv => inv.status !== 'paid')
      .reduce((sum, inv) => sum + (typeof inv.amount === 'number' ? inv.amount : 0), 0);

    // Overdue amount
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + (typeof inv.amount === 'number' ? inv.amount : 0), 0);

    // This month recovered
    const thisMonthRecovered = invoices
      .filter(inv => {
        if (inv.status !== 'paid' || !inv.paidDate) return false;
        const paidDate = safeDate(inv.paidDate);
        return paidDate.getMonth() === now.getMonth() && 
               paidDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, inv) => sum + (typeof inv.amount === 'number' ? inv.amount : 0), 0);

    // Average days to payment
    const paidInvoices = invoices.filter(
      inv => inv.status === 'paid' && inv.paidDate && inv.dueDate
    );
    
    let averageDaysToPayment = 0;
    if (paidInvoices.length > 0) {
      const totalDays = paidInvoices.reduce((sum, inv) => {
        const paidDate = safeDate(inv.paidDate);
        const dueDate = safeDate(inv.dueDate);
        const diffMs = paidDate.getTime() - dueDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return sum + diffDays;
      }, 0);
      averageDaysToPayment = Math.round(totalDays / paidInvoices.length);
    }

    // Success rate
    const successRate = invoices.length > 0
      ? Math.round((invoices.filter(inv => inv.status === 'paid').length / invoices.length) * 100)
      : 0;

    return {
      totalRecovered,
      totalOutstanding,
      overdueAmount,
      thisMonthRecovered,
      averageDaysToPayment,
      successRate,
    };
  }, [invoices]);

  return {
    analytics,
    isLoading: false,
  };
};
