// ── Domain types ────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired' | 'converted';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'partially_paid' | 'cancelled';
export type LineItemType = 'labor' | 'material';
export type Frequency = 'weekly' | 'monthly' | 'yearly';
export type OnboardingStep = 'welcome' | 'profile' | 'preferences' | 'complete';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'none';

export interface UserProfile {
  uid: string;
  fullName?: string;
  businessName: string;
  industry?: string;
  mobileNumber?: string;
  logoUrl?: string;
  defaultLaborRate: number;
  defaultTaxRate: number;
  defaultMarkup: number;
  terms: string;
  invoicePrefix?: string;
  invoiceCount?: number;
  quotePrefix?: string;
  quoteCount?: number;
  pdfStyle?: string;
  pdfFont?: string;
  defaultCurrency?: string;
  vatNumber?: string;
  businessRegistrationNumber?: string;
  address?: string;
  saTaxInvoiceMode?: boolean;
  country: string;
  bankName?: string;
  accountNumber?: string;
  accountType?: string;
  branchCode?: string;
  onboardingStep?: OnboardingStep;
  onboardingComplete?: boolean;
  profileComplete?: boolean;
  profileCompletion?: number;
  subscriptionStatus?: SubscriptionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditableLineItem {
  id: string;
  description: string;
  qty: number | string;
  unitCost: number | string;
  type: LineItemType;
  markupPercent: number | string;
}

export interface LineItem {
  id: string;
  quoteId?: string;
  templateId?: string;
  recurringInvoiceId?: string;
  description: string;
  qty: number;
  unitCost: number;
  type: LineItemType;
  markupPercent: number;
  sortOrder: number;
  createdAt?: string;
}

export interface Quote {
  id: string;
  uid: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  clientVatNumber?: string;
  notes?: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  vatAmount?: number;
  isSATaxInvoice?: boolean;
  isMilestone?: boolean;
  progressPercent?: number;
  status: QuoteStatus;
  contractorBusinessName?: string;
  contractorLogoUrl?: string;
  contractorTerms?: string;
  validityDays?: number;
  expiresAt?: string;
  approvedAt?: string;
  signatureName?: string;
  signatureDataUrl?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  pdfUrl?: string;
  pdfUpdatedAt?: string;
  isLegacyEstimate?: boolean;
  quoteNumber?: string;
  lineItems?: LineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  id: string;
  uid: string;
  quoteId?: string;
  estimateId?: string;
  invoiceNumber?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientVatNumber?: string;
  total: number;
  currency: string;
  status: InvoiceStatus;
  dueDate?: string;
  paidAt?: string;
  whatsappReminderLink?: string;
  whatsappReminderStatus?: string;
  whatsappReminderAt?: string;
  paystackReference?: string;
  lineItems?: LineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  vatNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  uid: string;
  name: string;
  description?: string;
  lineItems: LineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EditableExpense {
  id: string;
  description: string;
  amount: number | string;
  receiptUrl?: string;
  createdAt?: string;
}

export interface Expense {
  id: string;
  uid: string;
  quoteId?: string;
  description: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
  createdAt?: string;
}

export interface Attachment {
  id: string;
  uid: string;
  quoteId?: string;
  invoiceId?: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt?: string;
}

export interface RecurringInvoice {
  id: string;
  uid: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  frequency: Frequency;
  nextIssueDate?: string;
  status: 'active' | 'paused';
  total: number;
  currency: string;
  lineItems: LineItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurringQuote {
  id: string;
  uid: string;
  clientId?: string;
  clientName: string;
  templateQuoteId?: string;
  frequency: Frequency;
  nextIssueDate?: string;
  status: 'active' | 'paused';
  createdAt?: string;
}
