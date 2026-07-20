import React from 'react';
import { motion } from 'motion/react';
import { X, AlertCircle, Zap, Clock, Check } from 'lucide-react';
import { Invoice } from '../../types';
import { formatCurrency } from '../../utils';

interface NotificationCenterProps {
  invoices: Invoice[];
  currency: string;
  onClose: () => void;
  onSelectInvoice: (id: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  invoices,
  currency,
  onClose,
  onSelectInvoice,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = invoices.filter(
    (inv) => inv.status !== 'paid' && new Date(inv.dueDate).getTime() < today.getTime()
  );
  const dueToday = invoices.filter(
    (inv) => inv.status !== 'paid' && new Date(inv.dueDate).getTime() === today.getTime()
  );
  const upcoming = invoices.filter((inv) => {
    if (inv.status === 'paid') return false;
    const due = new Date(inv.dueDate).getTime();
    return due > today.getTime() && due <= today.getTime() + 2 * 24 * 60 * 60 * 1000;
  });

  const totalUrgent = overdue.length + dueToday.length + upcoming.length;

  const getDaysLate = (dueDate: string) => {
    const due = new Date(dueDate).getTime();
    return Math.ceil((today.getTime() - due) / (1000 * 60 * 60 * 24));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-title"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl transition-colors"
      >
        <div className="bg-slate-900 dark:bg-slate-900 p-8 text-white flex justify-between items-center">
          <div>
            <h3 id="notification-title" className="text-2xl font-black tracking-tight">Daily Pulse</h3>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mt-1">
              {totalUrgent > 0 ? `${totalUrgent} Items need attention` : 'All clear for now'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {overdue.length > 0 && (
            <section aria-label="Overdue invoices">
              <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                Overdue
              </h4>
              <div className="space-y-2" role="list">
                {overdue.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => {
                      onSelectInvoice(inv.id);
                      onClose();
                    }}
                    className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-800 flex justify-between items-center group active:scale-95 transition-all"
                    role="listitem"
                    aria-label={`${inv.clientName}, ${formatCurrency(inv.amount, currency)}, ${getDaysLate(inv.dueDate)} days late`}
                  >
                    <div className="text-left">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{inv.clientName}</p>
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                        Late by {getDaysLate(inv.dueDate)} days
                      </p>
                    </div>
                    <p className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(inv.amount, currency)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {dueToday.length > 0 && (
            <section aria-label="Due today">
              <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3" aria-hidden="true" />
                Due Today
              </h4>
              <div className="space-y-2" role="list">
                {dueToday.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => {
                      onSelectInvoice(inv.id);
                      onClose();
                    }}
                    className="w-full p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 flex justify-between items-center active:scale-95 transition-all"
                    role="listitem"
                  >
                    <div className="text-left">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{inv.clientName}</p>
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                        Action required now
                      </p>
                    </div>
                    <p className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(inv.amount, currency)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-label="Coming up">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3" aria-hidden="true" />
                Coming Up
              </h4>
              <div className="space-y-2" role="list">
                {upcoming.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => {
                      onSelectInvoice(inv.id);
                      onClose();
                    }}
                    className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex justify-between items-center active:scale-95 transition-all"
                    role="listitem"
                  >
                    <div className="text-left">
                      <p className="font-black text-slate-900 dark:text-white text-sm">{inv.clientName}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                        Due in 48 hours
                      </p>
                    </div>
                    <p className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(inv.amount, currency)}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {totalUrgent === 0 && (
            <div className="text-center py-12" role="status">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="font-black text-slate-900 dark:text-white">You're all caught up!</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-medium mt-1">
                No urgent payments detected.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 transition-colors">
          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default NotificationCenter;
