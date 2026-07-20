import React from 'react';
import { FileText, Plus } from 'lucide-react';
import { Invoice } from '../../types';
import { InvoiceCard } from './InvoiceCard';

interface InvoiceListProps {
  invoices: Invoice[];
  currency: string;
  onInvoiceClick: (id: number) => void;
  onAddInvoice: () => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  invoices,
  currency,
  onInvoiceClick,
  onAddInvoice,
}) => {
  const sortedInvoices = [...invoices].sort((a, b) => b.id - a.id);

  if (invoices.length === 0) {
    return (
      <div
        className="bg-white dark:bg-slate-800 rounded-[32px] sm:rounded-[48px] border-4 border-dashed border-gray-100 dark:border-slate-700 p-12 sm:p-24 text-center transition-colors"
        role="region"
        aria-label="No invoices"
      >
        <div
          className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8"
          aria-hidden="true"
        >
          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-200 dark:text-slate-600" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 sm:mb-3">
          Your Book is Clear
        </h3>
        <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[8px] sm:text-[9px] mb-8 sm:mb-12 max-w-xs mx-auto leading-relaxed">
          No unpaid invoices found. Use the button below to track a new debt.
        </p>
        <button
          onClick={onAddInvoice}
          className="bg-blue-600 hover:bg-blue-700 text-white px-10 sm:px-14 py-4 sm:py-5 rounded-xl sm:rounded-[24px] font-black text-sm sm:text-base shadow-xl active:scale-95 transition-all"
          aria-label="Add new invoice"
        >
          Add Entry
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4" role="list" aria-label="Invoice list">
      {sortedInvoices.map((invoice) => (
        <InvoiceCard
          key={invoice.id}
          invoice={invoice}
          currency={currency}
          onClick={() => onInvoiceClick(invoice.id)}
        />
      ))}
    </div>
  );
};

export default InvoiceList;
