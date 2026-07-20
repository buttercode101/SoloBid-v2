import React from 'react';
import { TrendingUp, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Analytics } from '../../types';
import { formatCurrency } from '../../utils';

interface AnalyticsCardProps {
  analytics: Analytics;
  currency: string;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  analytics,
  currency,
}) => {
  const {
    totalRecovered,
    totalOutstanding,
    overdueAmount,
    successRate,
    averageDaysToPayment,
  } = analytics;

  return (
    <div
      className="bg-slate-900 dark:bg-slate-800 rounded-[32px] sm:rounded-[48px] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden transition-colors"
      role="region"
      aria-label="Financial analytics summary"
    >
      <div
        className="absolute top-0 right-0 p-10 opacity-[0.03]"
        aria-hidden="true"
      >
        <TrendingUp className="w-64 h-64" />
      </div>
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] mb-2">
            Total Recovered
          </p>
          <p
            className="text-4xl sm:text-6xl font-black tracking-tighter"
            aria-label={`Total recovered: ${formatCurrency(totalRecovered, currency)}`}
          >
            {formatCurrency(totalRecovered, currency)}
          </p>
          <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3">
            <div
              className="bg-emerald-500/10 text-emerald-400 dark:text-emerald-300 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border border-emerald-500/10"
              role="status"
            >
              <CheckCircle className="w-3 h-3 inline mr-1" aria-hidden="true" />
              {successRate}% Success
            </div>
            {averageDaysToPayment !== 0 && (
              <div className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
                <Clock className="w-3 h-3 inline mr-1" aria-hidden="true" />
                ~{averageDaysToPayment} Days to Pay
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div
            className="bg-white/5 border border-white/10 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] hover:bg-white/[0.08] transition-colors"
            role="status"
            aria-label={`Pending amount: ${formatCurrency(totalOutstanding, currency)}`}
          >
            <p className="text-slate-500 dark:text-slate-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-1">
              Pending
            </p>
            <p className="text-xl sm:text-2xl font-black">
              {formatCurrency(totalOutstanding, currency)}
            </p>
          </div>
          <div
            className="bg-red-500/5 border border-red-500/10 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] hover:bg-red-500/[0.08] transition-colors"
            role="alert"
            aria-label={`Overdue amount: ${formatCurrency(overdueAmount, currency)}`}
          >
            <p className="text-red-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              Overdue
            </p>
            <p className="text-xl sm:text-2xl font-black text-red-100">
              {formatCurrency(overdueAmount, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsCard;
