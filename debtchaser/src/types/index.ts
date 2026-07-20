export type InvoiceStatus = 'overdue' | 'pending' | 'upcoming' | 'paid' | 'disputed';
export type MessageTone = 'courtesy' | 'action' | 'inquiry' | 'firm' | 'final';
export type ReminderType = 'courtesy' | 'action' | 'inquiry' | 'firm' | 'final';

export interface Message {
  date: string;
  type: MessageTone;
  sent: boolean;
}

export interface Invoice {
  id: number;
  clientName: string;
  amount: number;
  dueDate: string;
  clientPhone: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  remindersSent: number;
  messages: Message[];
  createdAt: string;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  paymentNotes?: string;
  lastReminder?: string;
}

export interface Settings {
  businessName: string;
  businessEmail: string;
  currency: string;
  messageStyle: MessageTone;
  firstReminderDays: number;
  escalationDays: number;
  workingHoursOnly: boolean;
  pauseWeekends: boolean;
  whatsappConnected: boolean;
  autoSend: boolean;
  language: string;
  darkMode: boolean;
}

export interface Analytics {
  totalRecovered: number;
  totalOutstanding: number;
  overdueAmount: number;
  thisMonthRecovered: number;
  averageDaysToPayment: number;
  successRate: number;
}

export interface NotificationItem {
  id: number;
  invoiceId: number;
  clientName: string;
  amount: number;
  currency: string;
  type: 'overdue' | 'dueToday' | 'upcoming';
  daysOverdue?: number;
  message: string;
}

export interface StorageResult {
  value: string;
}

export interface InvoiceFormData {
  clientName: string;
  amount: string;
  dueDate: string;
  clientPhone: string;
  invoiceNumber: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
