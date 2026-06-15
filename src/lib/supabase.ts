/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://kkxgrsmmwajcbuuigayf.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreGdyc21td2FqY2J1dWlnYXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzEyNzcsImV4cCI6MjA5NzA0NzI3N30.NUgq9WRf9q8LgOKEUBMg8sDufmR8jQIweDZwPPB71W4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ── Mapper utilities ────────────────────────────────────────────────────────

export function fromDbUser(row: any): any {
  if (!row) return null;
  return {
    uid: row.id,
    fullName: row.full_name,
    businessName: row.business_name || '',
    industry: row.industry,
    mobileNumber: row.mobile_number,
    logoUrl: row.logo_url,
    defaultLaborRate: row.default_labor_rate ?? 0,
    defaultTaxRate: row.default_tax_rate ?? 15,
    defaultMarkup: row.default_markup ?? 0,
    terms: row.terms || '',
    invoicePrefix: row.invoice_prefix || 'INV-',
    invoiceCount: row.invoice_count ?? 0,
    quotePrefix: row.quote_prefix || 'QTE-',
    quoteCount: row.quote_count ?? 0,
    pdfStyle: row.pdf_style || 'modern',
    pdfFont: row.pdf_font || 'Helvetica',
    defaultCurrency: row.default_currency || 'ZAR',
    vatNumber: row.vat_number,
    businessRegistrationNumber: row.business_registration_number,
    address: row.address,
    saTaxInvoiceMode: row.sa_tax_invoice_mode,
    country: row.country || 'ZA',
    onboardingStep: row.onboarding_step,
    onboardingComplete: row.onboarding_complete,
    profileComplete: row.profile_complete,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbUser(profile: any): any {
  const row: any = {};
  if (profile.uid !== undefined) row.id = profile.uid;
  if (profile.fullName !== undefined) row.full_name = profile.fullName;
  if (profile.businessName !== undefined) row.business_name = profile.businessName;
  if (profile.industry !== undefined) row.industry = profile.industry;
  if (profile.mobileNumber !== undefined) row.mobile_number = profile.mobileNumber;
  if (profile.logoUrl !== undefined) row.logo_url = profile.logoUrl;
  if (profile.defaultLaborRate !== undefined) row.default_labor_rate = profile.defaultLaborRate;
  if (profile.defaultTaxRate !== undefined) row.default_tax_rate = profile.defaultTaxRate;
  if (profile.defaultMarkup !== undefined) row.default_markup = profile.defaultMarkup;
  if (profile.terms !== undefined) row.terms = profile.terms;
  if (profile.invoicePrefix !== undefined) row.invoice_prefix = profile.invoicePrefix;
  if (profile.invoiceCount !== undefined) row.invoice_count = profile.invoiceCount;
  if (profile.quotePrefix !== undefined) row.quote_prefix = profile.quotePrefix;
  if (profile.quoteCount !== undefined) row.quote_count = profile.quoteCount;
  if (profile.pdfStyle !== undefined) row.pdf_style = profile.pdfStyle;
  if (profile.pdfFont !== undefined) row.pdf_font = profile.pdfFont;
  if (profile.defaultCurrency !== undefined) row.default_currency = profile.defaultCurrency;
  if (profile.vatNumber !== undefined) row.vat_number = profile.vatNumber;
  if (profile.businessRegistrationNumber !== undefined) row.business_registration_number = profile.businessRegistrationNumber;
  if (profile.address !== undefined) row.address = profile.address;
  if (profile.saTaxInvoiceMode !== undefined) row.sa_tax_invoice_mode = profile.saTaxInvoiceMode;
  if (profile.country !== undefined) row.country = profile.country;
  if (profile.onboardingStep !== undefined) row.onboarding_step = profile.onboardingStep;
  if (profile.onboardingComplete !== undefined) row.onboarding_complete = profile.onboardingComplete;
  if (profile.profileComplete !== undefined) row.profile_complete = profile.profileComplete;
  if (profile.subscriptionStatus !== undefined) row.subscription_status = profile.subscriptionStatus;
  return row;
}

export function fromDbQuote(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    clientId: row.client_id,
    clientName: row.client_name || '',
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    notes: row.notes,
    taxRate: row.tax_rate ?? 0,
    subtotal: row.subtotal ?? 0,
    taxAmount: row.tax_amount ?? 0,
    total: row.total ?? 0,
    currency: row.currency || 'ZAR',
    vatAmount: row.vat_amount ?? 0,
    isSATaxInvoice: row.is_sa_tax_invoice,
    isMilestone: row.is_milestone,
    progressPercent: row.progress_percent,
    status: row.status,
    contractorBusinessName: row.contractor_business_name,
    contractorLogoUrl: row.contractor_logo_url,
    contractorTerms: row.contractor_terms,
    validityDays: row.validity_days,
    expiresAt: row.expires_at,
    approvedAt: row.approved_at,
    signatureName: row.signature_name,
    signatureDataUrl: row.signature_data_url,
    rejectionReason: row.rejection_reason,
    rejectedAt: row.rejected_at,
    pdfUrl: row.pdf_url,
    pdfUpdatedAt: row.pdf_updated_at,
    isLegacyEstimate: row.is_legacy_estimate,
    quoteNumber: row.quote_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbQuote(quote: any): any {
  const row: any = {};
  if (quote.uid !== undefined) row.user_id = quote.uid;
  if (quote.clientId !== undefined) row.client_id = quote.clientId;
  if (quote.clientName !== undefined) row.client_name = quote.clientName;
  if (quote.clientEmail !== undefined) row.client_email = quote.clientEmail;
  if (quote.clientPhone !== undefined) row.client_phone = quote.clientPhone;
  if (quote.clientAddress !== undefined) row.client_address = quote.clientAddress;
  if (quote.notes !== undefined) row.notes = quote.notes;
  if (quote.taxRate !== undefined) row.tax_rate = quote.taxRate;
  if (quote.subtotal !== undefined) row.subtotal = quote.subtotal;
  if (quote.taxAmount !== undefined) row.tax_amount = quote.taxAmount;
  if (quote.total !== undefined) row.total = quote.total;
  if (quote.currency !== undefined) row.currency = quote.currency;
  if (quote.vatAmount !== undefined) row.vat_amount = quote.vatAmount;
  if (quote.isSATaxInvoice !== undefined) row.is_sa_tax_invoice = quote.isSATaxInvoice;
  if (quote.isMilestone !== undefined) row.is_milestone = quote.isMilestone;
  if (quote.progressPercent !== undefined) row.progress_percent = quote.progressPercent;
  if (quote.status !== undefined) row.status = quote.status;
  if (quote.contractorBusinessName !== undefined) row.contractor_business_name = quote.contractorBusinessName;
  if (quote.contractorLogoUrl !== undefined) row.contractor_logo_url = quote.contractorLogoUrl;
  if (quote.contractorTerms !== undefined) row.contractor_terms = quote.contractorTerms;
  if (quote.validityDays !== undefined) row.validity_days = quote.validityDays;
  if (quote.expiresAt !== undefined) row.expires_at = quote.expiresAt;
  if (quote.approvedAt !== undefined) row.approved_at = quote.approvedAt;
  if (quote.signatureName !== undefined) row.signature_name = quote.signatureName;
  if (quote.signatureDataUrl !== undefined) row.signature_data_url = quote.signatureDataUrl;
  if (quote.rejectionReason !== undefined) row.rejection_reason = quote.rejectionReason;
  if (quote.rejectedAt !== undefined) row.rejected_at = quote.rejectedAt;
  if (quote.pdfUrl !== undefined) row.pdf_url = quote.pdfUrl;
  if (quote.pdfUpdatedAt !== undefined) row.pdf_updated_at = quote.pdfUpdatedAt;
  if (quote.isLegacyEstimate !== undefined) row.is_legacy_estimate = quote.isLegacyEstimate;
  return row;
}

export function fromDbLineItem(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    quoteId: row.quote_id,
    templateId: row.template_id,
    recurringInvoiceId: row.recurring_invoice_id,
    description: row.description || '',
    qty: row.qty ?? 1,
    unitCost: row.unit_cost ?? 0,
    type: row.type || 'labor',
    markupPercent: row.markup_percent ?? 0,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}

export function toDbLineItem(item: any, parentId: { quoteId?: string; templateId?: string; recurringInvoiceId?: string }): any {
  return {
    id: item.id,
    quote_id: parentId.quoteId || null,
    template_id: parentId.templateId || null,
    recurring_invoice_id: parentId.recurringInvoiceId || null,
    description: item.description,
    qty: parseFloat(item.qty) || 1,
    unit_cost: parseFloat(item.unitCost) || 0,
    type: item.type || 'labor',
    markup_percent: parseFloat(item.markupPercent) || 0,
    sort_order: item.sortOrder ?? 0,
  };
}

export function fromDbExpense(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    quoteId: row.quote_id,
    description: row.description,
    amount: row.amount ?? 0,
    currency: row.currency || 'ZAR',
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
  };
}

export function toDbExpense(expense: any): any {
  return {
    id: expense.id,
    user_id: expense.uid,
    quote_id: expense.quoteId,
    description: expense.description,
    amount: parseFloat(expense.amount) || 0,
    currency: expense.currency || 'ZAR',
    receipt_url: expense.receiptUrl || null,
  };
}

export function fromDbClient(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbClient(client: any): any {
  const row: any = {};
  if (client.id !== undefined) row.id = client.id;
  if (client.uid !== undefined) row.user_id = client.uid;
  if (client.name !== undefined) row.name = client.name;
  if (client.email !== undefined) row.email = client.email;
  if (client.phone !== undefined) row.phone = client.phone;
  if (client.address !== undefined) row.address = client.address;
  if (client.notes !== undefined) row.notes = client.notes;
  return row;
}

export function fromDbInvoice(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    quoteId: row.quote_id,
    estimateId: row.quote_id, // alias for legacy compat
    invoiceNumber: row.invoice_number,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    total: row.total ?? 0,
    currency: row.currency || 'ZAR',
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    whatsappReminderLink: row.whatsapp_reminder_link,
    whatsappReminderStatus: row.whatsapp_reminder_status,
    whatsappReminderAt: row.whatsapp_reminder_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDbInvoice(inv: any): any {
  const row: any = {};
  if (inv.id !== undefined) row.id = inv.id;
  if (inv.uid !== undefined) row.user_id = inv.uid;
  if (inv.quoteId !== undefined) row.quote_id = inv.quoteId;
  if (inv.invoiceNumber !== undefined) row.invoice_number = inv.invoiceNumber;
  if (inv.clientName !== undefined) row.client_name = inv.clientName;
  if (inv.clientEmail !== undefined) row.client_email = inv.clientEmail;
  if (inv.clientPhone !== undefined) row.client_phone = inv.clientPhone;
  if (inv.total !== undefined) row.total = inv.total;
  if (inv.currency !== undefined) row.currency = inv.currency;
  if (inv.status !== undefined) row.status = inv.status;
  if (inv.dueDate !== undefined) row.due_date = inv.dueDate;
  if (inv.paidAt !== undefined) row.paid_at = inv.paidAt;
  return row;
}

export function fromDbTemplate(row: any, lineItems?: any[]): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    name: row.name,
    description: row.description,
    lineItems: (lineItems || []).map(fromDbLineItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function fromDbRecurring(row: any, lineItems?: any[]): any {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.user_id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    frequency: row.frequency,
    nextIssueDate: row.next_issue_date,
    status: row.status,
    total: row.total ?? 0,
    currency: row.currency || 'ZAR',
    lineItems: (lineItems || []).map(fromDbLineItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
