import React, { useState, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { Plus, Zap, Shield, History, FileText, BellRing } from 'lucide-react';

// Components
import { ErrorBoundary, LoadingSpinner } from './components/shared';
import { Header, Layout } from './components/layout';
import { AnalyticsCard } from './components/dashboard';
import { InvoiceList, InvoiceForm } from './components/invoice';
import {
  NotificationCenter,
  SettingsModal,
  DeleteConfirmModal,
  SendConfirmModal,
  PaymentLogModal,
} from './components/modals';
import { OnboardingFlow } from './components/onboarding';

// Hooks
import { useInvoices, useSettings, useAnalytics, useOnboarding, useNotifications, useDarkMode } from './hooks';

// Services
import { copyToClipboard, shareReminder, exportInvoicesToCSV, storageService, STORAGE_KEYS } from './services';

// Utils
import { getDaysOverdue, getInvoiceStatus } from './utils/date';
import { getReminderType, formatMessage } from './utils/templates';

// Constants
import { STATUS_COLORS } from './constants';

// Types
import { Invoice } from './types';

function DebtChaser() {
  // State
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showPaymentLog, setShowPaymentLog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Custom hooks
  const {
    invoices,
    loading: invoicesLoading,
    error: invoicesError,
    addInvoice,
    deleteInvoice,
    markAsPaid,
    recordReminderSent,
    getInvoiceById,
  } = useInvoices();

  const {
    settings,
    loading: settingsLoading,
    updateSettings,
  } = useSettings();

  const { analytics } = useAnalytics(invoices);
  const { hasSeenOnboarding, completeOnboarding } = useOnboarding();
  const { requestPermission } = useNotifications(invoices);
  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  // Derived state
  const selectedInvoice = selectedInvoiceId ? getInvoiceById(selectedInvoiceId) : null;
  const hasUrgentPayments = invoices.some(
    (inv) => inv.status !== 'paid' && getDaysOverdue(inv.dueDate) >= 0
  );

  // Handlers
  const handleAddInvoice = useCallback(
    async (data: any) => {
      const result = await addInvoice(data);
      if (result.success) {
        setShowUpload(false);
      }
    },
    [addInvoice]
  );

  const handleDeleteInvoice = useCallback(async () => {
    if (selectedInvoiceId) {
      await deleteInvoice(selectedInvoiceId);
      setShowDeleteConfirm(false);
      setSelectedInvoiceId(null);
    }
  }, [selectedInvoiceId, deleteInvoice]);

  const handleMarkAsPaid = useCallback(async () => {
    if (selectedInvoiceId) {
      await markAsPaid(selectedInvoiceId);
      setShowPaymentLog(false);
    }
  }, [selectedInvoiceId, markAsPaid]);

  const handleCopyMessage = useCallback(async () => {
    if (selectedInvoice) {
      const message = formatMessage(selectedInvoice, settings.currency);
      const success = await copyToClipboard(message);
      if (success) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
        await recordReminderSent(selectedInvoice.id);
      }
    }
  }, [selectedInvoice, settings.currency, recordReminderSent]);

  const handleShare = useCallback(
    async (channel: 'whatsapp' | 'sms' | 'native') => {
      if (selectedInvoice) {
        const result = await shareReminder({
          invoice: selectedInvoice,
          currency: settings.currency,
          channel,
        });
        if (result.success) {
          await recordReminderSent(selectedInvoice.id);
          setShowSendConfirm(false);
        }
      }
    },
    [selectedInvoice, settings.currency, recordReminderSent]
  );

  const handleExport = useCallback(() => {
    exportInvoicesToCSV(invoices, settings.currency);
  }, [invoices, settings.currency]);

  const handleReset = useCallback(async () => {
    if (!confirm('⚠️ PERMANENT: Delete all data? This cannot be undone.')) return;

    setIsResetting(true);
    try {
      await storageService.clear();
      setTimeout(() => {
        window.location.replace(window.location.origin);
      }, 1000);
    } catch (err) {
      console.error('System Reset Failed:', err);
      setIsResetting(false);
    }
  }, []);

  const handleRequestNotifications = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  // Loading state
  if (invoicesLoading || settingsLoading) {
    return <LoadingSpinner message="Initializing System" />;
  }

  // Onboarding
  if (!hasSeenOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  return (
    <Layout
      header={
        <Header
          businessName={settings.businessName}
          hasUrgentPayments={hasUrgentPayments}
          onNotificationClick={() => setShowNotificationCenter(true)}
          onSettingsClick={() => setShowSettings(true)}
        />
      }
    >
      {/* Error display */}
      {invoicesError && (
        <div
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6"
          role="alert"
        >
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{invoicesError}</p>
        </div>
      )}

      <div className="space-y-8 sm:space-y-12">
        {/* Analytics Dashboard */}
        {invoices.length > 0 && (
          <AnalyticsCard analytics={analytics} currency={settings.currency} />
        )}

        {/* Invoice List */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] text-[9px] sm:text-[10px] flex items-center gap-2 sm:gap-3">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-500" />
              Active Receivables
            </h2>
          </div>

          <InvoiceList
            invoices={invoices}
            currency={settings.currency}
            onInvoiceClick={setSelectedInvoiceId}
            onAddInvoice={() => setShowUpload(true)}
          />
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 sm:bottom-10 inset-x-0 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg px-6 sm:px-8 pointer-events-auto">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 sm:py-6 rounded-[24px] sm:rounded-[30px] font-black text-lg sm:text-xl flex items-center justify-center gap-3 sm:gap-4 shadow-3xl active:scale-95 border-4 border-white dark:border-slate-800 transition-all hover:bg-slate-800 dark:hover:bg-blue-700"
            aria-label="Add new record"
          >
            <Plus className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            New Record
          </button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNotificationCenter && (
          <NotificationCenter
            invoices={invoices}
            currency={settings.currency}
            onClose={() => setShowNotificationCenter(false)}
            onSelectInvoice={(id) => {
              setSelectedInvoiceId(id);
              setShowNotificationCenter(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            settings={settings}
            onSave={updateSettings}
            onClose={() => setShowSettings(false)}
            onExport={handleExport}
            onReset={handleReset}
            isResetting={isResetting}
            onRequestNotifications={handleRequestNotifications}
            darkMode={isDark}
            onToggleDarkMode={toggleDarkMode}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpload && <InvoiceForm onSubmit={handleAddInvoice} onCancel={() => setShowUpload(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedInvoice && (
          <InvoiceDetail
            invoice={selectedInvoice}
            settings={settings}
            onClose={() => setSelectedInvoiceId(null)}
            onDelete={() => setShowDeleteConfirm(true)}
            onSendReminder={() => setShowSendConfirm(true)}
            onMarkPaid={() => setShowPaymentLog(true)}
            getDaysOverdue={getDaysOverdue}
            getReminderType={getReminderType}
            formatMessage={formatMessage}
            getStatusColor={(status: string) => STATUS_COLORS[status] || STATUS_COLORS.upcoming}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteConfirm && (
          <DeleteConfirmModal onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteInvoice} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSendConfirm && selectedInvoice && (
          <SendConfirmModal
            invoice={selectedInvoice}
            settings={settings}
            onClose={() => setShowSendConfirm(false)}
            onCopy={handleCopyMessage}
            onShare={handleShare}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentLog && <PaymentLogModal onClose={() => setShowPaymentLog(false)} onConfirm={handleMarkAsPaid} />}
      </AnimatePresence>

      {/* Copy success toast */}
      {copySuccess && (
        <div className="fixed bottom-32 inset-x-0 z-[200] flex justify-center pointer-events-none">
          <div className="bg-slate-900 dark:bg-blue-600 text-white px-8 py-4 rounded-full font-black text-xs shadow-3xl animate-bounce uppercase tracking-widest flex items-center gap-3 pointer-events-auto">
            <CheckCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            Copied
          </div>
        </div>
      )}
    </Layout>
  );
}

// Invoice Detail Component (inline for now - could be extracted)
const InvoiceDetail: React.FC<{
  invoice: Invoice;
  settings: any;
  onClose: () => void;
  onDelete: () => void;
  onSendReminder: () => void;
  onMarkPaid: () => void;
  getDaysOverdue: (date: string) => number;
  getReminderType: (date: string) => string;
  formatMessage: (invoice: Invoice, currency: string) => string;
  getStatusColor: (status: string) => string;
}> = ({
  invoice,
  settings,
  onClose,
  onDelete,
  onSendReminder,
  onMarkPaid,
  getDaysOverdue,
  getReminderType,
  formatMessage,
  getStatusColor,
}) => {
  const days = getDaysOverdue(invoice.dueDate);
  const reminderType = getReminderType(invoice.dueDate);
  const message = formatMessage(invoice, settings.currency);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[55] overflow-y-auto pb-40 transition-colors"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-detail-title"
    >
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-10 px-4 sm:px-6 py-4 sm:py-6 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl sm:rounded-2xl text-slate-400 dark:text-slate-300 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <h1 id="invoice-detail-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
            {invoice.clientName}
          </h1>
          <div className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Summary Card */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] sm:rounded-[40px] border border-gray-200 dark:border-slate-700 p-6 sm:p-10 shadow-sm text-center transition-colors">
          <span
            className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-2 ${getStatusColor(
              invoice.status
            )}`}
            role="status"
          >
            {invoice.status === 'overdue' ? `🚨 ${days}D OVERDUE` : invoice.status}
          </span>
          <p className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white mt-4 sm:mt-6 tracking-tighter">
            {settings.currency}
            {invoice.amount.toLocaleString()}
          </p>
          <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[8px] sm:text-[9px] mt-2">
            Expected by {new Date(invoice.dueDate).toLocaleDateString('en-ZA', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Message Logs */}
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-black text-slate-900 dark:text-white uppercase tracking-widest text-[9px] sm:text-[10px] flex items-center gap-2 sm:gap-3">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
              Logs
            </h2>
            <button
              onClick={onDelete}
              className="text-red-500 text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              Purge
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[24px] sm:rounded-[32px] border border-gray-200 dark:border-slate-700 p-6 sm:p-8 shadow-sm transition-colors">
            {invoice.messages.length === 0 ? (
              <div className="text-center py-8 sm:py-10 opacity-30 italic font-medium flex flex-col items-center gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700 rounded-full">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 dark:text-slate-500" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">No reminders logged yet.</span>
              </div>
            ) : (
              invoice.messages.map((msg, idx) => (
                <div key={idx} className="mb-5 sm:mb-6 last:mb-0">
                  <div className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest text-center mb-2 sm:mb-3">
                    {new Date(msg.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                  </div>
                  <WhatsAppMessage message={message} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {invoice.status !== 'paid' && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <div className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 p-4 sm:p-6 transition-colors">
            <div className="w-full max-w-2xl px-4 sm:px-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={onSendReminder}
                className="flex-[2] py-4 sm:py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl font-black text-base sm:text-lg shadow-xl active:scale-95 flex flex-col items-center justify-center gap-0.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                  Send Reminder
                </div>
                <span className="text-[9px] uppercase tracking-widest opacity-80 font-bold">
                  Smart Logic: {MESSAGE_TEMPLATES[reminderType as keyof typeof MESSAGE_TEMPLATES]?.title || 'Reminder'}
                </span>
              </button>
              <button
                onClick={onMarkPaid}
                className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-2 sm:border-4 border-slate-900 dark:border-slate-600 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                Settled
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Import motion and icons for InvoiceDetail
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Clock, Send, CheckCheck } from 'lucide-react';
import { WhatsAppMessage } from './components/shared';
import { MESSAGE_TEMPLATES } from './constants';

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <DebtChaser />
    </ErrorBoundary>
  );
}
