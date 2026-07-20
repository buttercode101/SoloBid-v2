import React, { useState, useCallback } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { InvoiceFormData } from '../../types';
import { validateInvoiceForm } from '../../utils/validation';

interface InvoiceFormProps {
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  onCancel: () => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<InvoiceFormData>({
    clientName: '',
    amount: '',
    dueDate: '',
    clientPhone: '',
    invoiceNumber: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  }, [errors.length]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const validation = validateInvoiceForm(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Form will be reset by parent component
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to create invoice']);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit]);

  const isFormValid = formData.clientName.trim() && formData.amount && formData.dueDate;

  return (
    <div
      className="fixed inset-0 bg-white dark:bg-slate-900 z-[70] overflow-y-auto transition-colors"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-title"
    >
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-10 px-4 sm:px-6 py-4 sm:py-6 w-full flex items-center justify-center transition-colors">
        <div className="w-full max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={onCancel}
              className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl sm:rounded-2xl text-slate-400 dark:text-slate-300 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 id="form-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              New Receivable
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
          {errors.length > 0 && (
            <div
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4"
              role="alert"
              aria-live="assertive"
            >
              <ul className="list-disc list-inside text-red-600 dark:text-red-400 text-sm font-medium">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-6 sm:gap-8">
            <div className="space-y-3">
              <label
                htmlFor="clientName"
                className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1"
              >
                Client / Company Name <span className="text-red-500" aria-label="required">*</span>
              </label>
              <div className="relative group">
                <input
                  type="text"
                  id="clientName"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleChange}
                  placeholder="e.g. Acme Hardware"
                  className="w-full px-5 py-4 border border-gray-200 dark:border-slate-600 rounded-[22px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 transition-all duration-300 outline-none shadow-sm hover:border-gray-300 dark:hover:border-slate-500 font-medium"
                  required
                  aria-required="true"
                />
                {formData.clientName && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, clientName: '' }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 transition-colors"
                    aria-label="Clear client name"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label
                  htmlFor="amount"
                  className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1"
                >
                  Amount Owed <span className="text-red-500" aria-label="required">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="w-full px-5 py-4 border border-gray-200 dark:border-slate-600 rounded-[22px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 transition-all duration-300 outline-none shadow-sm hover:border-gray-300 dark:hover:border-slate-500 font-medium"
                  required
                  aria-required="true"
                />
              </div>
              <div className="space-y-3">
                <label
                  htmlFor="dueDate"
                  className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1"
                >
                  Due Date <span className="text-red-500" aria-label="required">*</span>
                </label>
                <input
                  type="date"
                  id="dueDate"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  className="w-full px-5 py-4 border border-gray-200 dark:border-slate-600 rounded-[22px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 transition-all duration-300 outline-none shadow-sm hover:border-gray-300 dark:hover:border-slate-500 font-medium"
                  required
                  aria-required="true"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="clientPhone"
                className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1"
              >
                WhatsApp Contact
              </label>
              <input
                type="tel"
                id="clientPhone"
                name="clientPhone"
                value={formData.clientPhone}
                onChange={handleChange}
                placeholder="+..."
                className="w-full px-5 py-4 border border-gray-200 dark:border-slate-600 rounded-[22px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 transition-all duration-300 outline-none shadow-sm hover:border-gray-300 dark:hover:border-slate-500 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 sm:py-6 rounded-2xl sm:rounded-[28px] font-black text-lg sm:text-xl disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:text-slate-300 dark:disabled:text-slate-500 transition-all shadow-2xl active:scale-95"
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Record'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceForm;
