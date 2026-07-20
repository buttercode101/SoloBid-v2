import { useState, useCallback, useEffect } from 'react';
import { Invoice, InvoiceFormData, ValidationResult } from '../types';
import { loadInvoices, saveInvoices } from '../services/storage';
import { validateInvoiceForm, validateInvoice } from '../utils/validation';
import { getInvoiceStatus } from '../utils/date';

export interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  addInvoice: (data: InvoiceFormData) => Promise<{ success: boolean; error?: string }>;
  updateInvoice: (id: number, data: Partial<Invoice>) => Promise<{ success: boolean; error?: string }>;
  deleteInvoice: (id: number) => Promise<void>;
  markAsPaid: (id: number) => Promise<void>;
  recordReminderSent: (id: number) => Promise<void>;
  getInvoiceById: (id: number) => Invoice | undefined;
  refreshInvoices: () => Promise<void>;
}

export const useInvoices = (): UseInvoicesReturn => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load invoices from storage
   */
  const refreshInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await loadInvoices();
      setInvoices(loaded);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(errorMessage);
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refreshInvoices();
  }, [refreshInvoices]);

  /**
   * Add new invoice
   */
  const addInvoice = useCallback(async (
    data: InvoiceFormData
  ): Promise<{ success: boolean; error?: string }> => {
    // Validate input
    const validation: ValidationResult = validateInvoiceForm(data);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    try {
      const newInvoice: Invoice = {
        id: Date.now(),
        clientName: data.clientName.trim(),
        amount: Number(data.amount),
        dueDate: data.dueDate,
        clientPhone: data.clientPhone.trim(),
        invoiceNumber: data.invoiceNumber.trim() || `INV-${Date.now()}`,
        status: getInvoiceStatus(data.dueDate),
        remindersSent: 0,
        messages: [],
        createdAt: new Date().toISOString(),
      };

      // Validate the created invoice
      const invoiceValidation = validateInvoice(newInvoice);
      if (!invoiceValidation.valid) {
        return { success: false, error: invoiceValidation.errors.join(', ') };
      }

      const updated = [...invoices, newInvoice];
      await saveInvoices(updated);
      setInvoices(updated);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add invoice';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [invoices]);

  /**
   * Update existing invoice
   */
  const updateInvoice = useCallback(async (
    id: number,
    data: Partial<Invoice>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Merge and validate
      const updatedInvoice = { ...invoice, ...data };
      const validation = validateInvoice(updatedInvoice);
      
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
      }

      const updated = invoices.map(inv => 
        inv.id === id ? updatedInvoice : inv
      );
      
      await saveInvoices(updated);
      setInvoices(updated);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update invoice';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [invoices]);

  /**
   * Delete invoice
   */
  const deleteInvoice = useCallback(async (id: number): Promise<void> => {
    try {
      const updated = invoices.filter(inv => inv.id !== id);
      await saveInvoices(updated);
      setInvoices(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete invoice';
      setError(errorMessage);
      throw err;
    }
  }, [invoices]);

  /**
   * Mark invoice as paid
   */
  const markAsPaid = useCallback(async (id: number): Promise<void> => {
    try {
      const updated = invoices.map(inv => 
        inv.id === id 
          ? {
              ...inv,
              status: 'paid' as const,
              paidDate: new Date().toISOString(),
              paidAmount: inv.amount,
            }
          : inv
      );
      await saveInvoices(updated);
      setInvoices(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as paid';
      setError(errorMessage);
      throw err;
    }
  }, [invoices]);

  /**
   * Record reminder sent
   */
  const recordReminderSent = useCallback(async (id: number): Promise<void> => {
    try {
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const { getReminderType } = await import('../utils/templates');
      const messageType = getReminderType(invoice.dueDate);

      const updated = invoices.map(inv => 
        inv.id === id 
          ? {
              ...inv,
              messages: [
                ...inv.messages, 
                { date: new Date().toISOString(), type: messageType, sent: true }
              ],
              remindersSent: inv.remindersSent + 1,
              lastReminder: new Date().toISOString(),
            }
          : inv
      );
      
      await saveInvoices(updated);
      setInvoices(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record reminder';
      setError(errorMessage);
      throw err;
    }
  }, [invoices]);

  /**
   * Get invoice by ID
   */
  const getInvoiceById = useCallback((id: number): Invoice | undefined => {
    return invoices.find(inv => inv.id === id);
  }, [invoices]);

  return {
    invoices,
    loading,
    error,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    recordReminderSent,
    getInvoiceById,
    refreshInvoices,
  };
};
