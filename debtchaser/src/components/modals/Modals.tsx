import React from 'react';
import { motion } from 'motion/react';
import { X, AlertCircle, Trash2, CheckCircle, Send, Smartphone, MessageSquare, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import { Invoice, Settings } from '../../types';
import { WhatsAppMessage } from '../shared';
import { MESSAGE_TEMPLATES, ReminderType } from '../../constants';
import { formatMessage } from '../../utils';

interface DeleteConfirmModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  onClose,
  onConfirm,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-[40px] w-full max-w-sm p-8 sm:p-10 shadow-2xl text-center border border-white/20 dark:border-slate-700 transition-colors"
      >
        <div
          className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-[32px] flex items-center justify-center mx-auto mb-8 animate-pulse shadow-inner"
          aria-hidden="true"
        >
          <AlertCircle className="w-12 h-12" />
        </div>
        <h3 id="delete-title" className="font-black text-3xl text-slate-900 dark:text-white mb-2 leading-tight">
          Delete Entry?
        </h3>
        <p id="delete-description" className="text-slate-400 dark:text-slate-500 mb-10 font-bold uppercase tracking-widest text-[9px] leading-relaxed">
          This record will be permanently purged from your records.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-[24px] font-black text-lg shadow-xl active:scale-95 transition-colors"
            aria-label="Confirm delete"
          >
            Delete Record
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Keep Entry
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface SendConfirmModalProps {
  invoice: Invoice;
  settings: Settings;
  onClose: () => void;
  onCopy: () => Promise<void>;
  onShare: (channel: 'whatsapp' | 'sms' | 'native') => Promise<void>;
}

export const SendConfirmModal: React.FC<SendConfirmModalProps> = ({
  invoice,
  settings,
  onClose,
  onCopy,
  onShare,
}) => {
  const message = formatMessage(invoice, settings.currency);
  
  // Determine reminder type
  const getReminderType = (): ReminderType => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return 'courtesy';
    if (diffDays === 0) return 'action';
    if (diffDays >= -7) return 'inquiry';
    if (diffDays >= -14) return 'firm';
    return 'final';
  };

  const type = getReminderType();
  const template = MESSAGE_TEMPLATES[type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-title"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-[40px] w-full max-w-lg p-10 shadow-2xl border border-white/20 dark:border-slate-700 transition-colors"
      >
        <div className="flex justify-between items-start mb-8">
          <h3 id="send-title" className="font-black text-3xl text-slate-900 dark:text-white flex items-center gap-4">
            <Send className="w-8 h-8 text-emerald-500" aria-hidden="true" />
            {template.title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-50 dark:bg-slate-700 rounded-full text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div
          className="bg-[#ECE5DD] dark:bg-slate-700 rounded-[32px] p-8 mb-10 border-2 border-emerald-50 dark:border-emerald-600 relative overflow-hidden"
          role="region"
          aria-label="Message preview"
        >
          <div className="absolute top-0 right-0 p-3 opacity-10" aria-hidden="true">
            <MessageSquare className="w-12 h-12" />
          </div>
          <WhatsAppMessage message={message} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {navigator.share && (
            <button
              onClick={() => onShare('native')}
              className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg active:scale-95 shadow-xl flex items-center justify-center gap-3 transition-colors"
            >
              <ExternalLink className="w-6 h-6" aria-hidden="true" />
              Share via...
            </button>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onShare('whatsapp')}
              className="py-5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl font-black text-lg active:scale-95 shadow-xl flex items-center justify-center gap-3 transition-colors"
            >
              <Smartphone className="w-6 h-6" aria-hidden="true" />
              WhatsApp
            </button>
            <button
              onClick={() => onShare('sms')}
              className="py-5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-2xl font-black text-lg active:scale-95 shadow-xl flex items-center justify-center gap-3 transition-colors"
            >
              <MessageSquare className="w-6 h-6" aria-hidden="true" />
              SMS
            </button>
          </div>

          <button
            onClick={async () => {
              await onCopy();
              onClose();
            }}
            className="w-full py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm active:scale-95 flex items-center justify-center gap-3 transition-colors"
          >
            <Copy className="w-5 h-5" aria-hidden="true" />
            Copy to Clipboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface PaymentLogModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const PaymentLogModal: React.FC<PaymentLogModalProps> = ({
  onClose,
  onConfirm,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[100] flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="payment-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-[40px] w-full max-w-sm p-8 sm:p-10 shadow-2xl text-center border border-white/20 dark:border-slate-700 transition-colors"
      >
        <div
          className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner"
          aria-hidden="true"
        >
          <CheckCircle className="w-12 h-12" />
        </div>
        <h3 id="payment-title" className="font-black text-3xl text-slate-900 dark:text-white mb-2 leading-tight">
          Mark Paid?
        </h3>
        <p className="text-slate-400 dark:text-slate-500 mb-10 font-bold uppercase tracking-widest text-[9px]">
          Confirm payment has been received in full.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] font-black text-lg shadow-xl active:scale-95 transition-colors"
          >
            Yes, It's Settled
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Not Yet
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DeleteConfirmModal;
