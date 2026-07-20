import React from 'react';
import { Calendar } from 'lucide-react';
import { Invoice } from '../../types';
import { STATUS_COLORS } from '../../constants';
import { formatDate, formatCurrency } from '../../utils';

interface InvoiceCardProps {
  invoice: Invoice;
  currency: string;
  onClick: () => void;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({
  invoice,
  currency,
  onClick,
}) => {
  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.upcoming;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white dark:bg-slate-800 rounded-[24px] sm:rounded-[32px] border border-gray-100 dark:border-slate-700 p-5 sm:p-8 text-left hover:border-blue-300 dark:hover:border-blue-600 transition-all flex items-center gap-4 sm:gap-6 active:scale-[0.98] shadow-sm group transition-colors"
      aria-label={`View details for ${invoice.clientName}, amount: ${formatCurrency(invoice.amount, currency)}, status: ${invoice.status}`}
    >
      <div
        className={`w-12 h-12 sm:w-16 sm:h-16 rounded-[18px] sm:rounded-[24px] flex items-center justify-center font-black text-xl sm:text-2xl transition-transform group-hover:scale-105 ${
          invoice.status === 'paid'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
            : invoice.status === 'overdue'
            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300'
        }`}
        aria-hidden="true"
      >
        {invoice.clientName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 truncate">
        <p className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight truncate">
          {invoice.clientName}
        </p>
        <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
          <span
            className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded border-2 ${statusColor}`}
            role="status"
          >
            {invoice.status}
          </span>
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 sm:gap-1.5">
            <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" aria-hidden="true" />
            {formatDate(invoice.dueDate)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p
          className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tighter"
          aria-label={`Amount: ${formatCurrency(invoice.amount, currency)}`}
        >
          {formatCurrency(invoice.amount, currency)}
        </p>
        <p className="text-[8px] sm:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-1">
          {invoice.remindersSent} {invoice.remindersSent === 1 ? 'Reminder' : 'Reminders'}
        </p>
      </div>
    </button>
  );
};

export default InvoiceCard;
