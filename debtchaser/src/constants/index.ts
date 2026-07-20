import { ReminderType } from '../types';

export type { ReminderType } from '../types';
export const MESSAGE_TEMPLATES: Record<ReminderType, { title: string; example: string }> = {
  courtesy: {
    title: "Courtesy Heads-up",
    example: "Hi {name}, just ensuring you have everything you need for the upcoming payment of {currency}{amount} due this {weekday} ({date}). Please let us know if you require a copy of the invoice or any bank details to keep things on track. Thanks!"
  },
  action: {
    title: "Action Day",
    example: "Hi {name}, today is the scheduled payment date for invoice #{number}. For your convenience, the total is {currency}{amount}. We appreciate your promptness in settling this today!"
  },
  inquiry: {
    title: "Inquiry Follow-up",
    example: "Hi {name}, it looks like the payment for #{number} hasn't reached us yet. We understand things get busy—could you please check if this was sent or if there's anything holding it up? We'd like to get this cleared for you."
  },
  firm: {
    title: "Firm Follow-up",
    example: "Hi {name}, this is our {reminder_count} follow-up regarding the outstanding balance of {currency}{amount}. This is now significantly overdue. Please confirm by end of day when the transfer will be completed so we can update your account status."
  },
  final: {
    title: "Final Notice",
    example: "Hi {name}, invoice #{number} for {currency}{amount} is now {days} days overdue. This is a formal request for immediate settlement. Please provide proof of payment today to avoid further escalation."
  }
};

export const CURRENCY_OPTIONS = [
  { value: 'R', label: 'R (ZAR)', symbol: 'R' },
  { value: '$', label: '$ (USD)', symbol: '$' },
  { value: '£', label: '£ (GBP)', symbol: '£' },
  { value: '€', label: '€ (EUR)', symbol: '€' },
];

export const STATUS_COLORS: Record<string, string> = {
  overdue: 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  pending: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  paid: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  upcoming: 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  disputed: 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
};

export const DEFAULT_SETTINGS = {
  businessName: "Your Business",
  businessEmail: "",
  currency: "R",
  messageStyle: "courtesy" as const,
  firstReminderDays: 2,
  escalationDays: 3,
  workingHoursOnly: true,
  pauseWeekends: false,
  whatsappConnected: true,
  autoSend: false,
  language: "English",
  darkMode: false,
};

export const STORAGE_KEYS = {
  INVOICES: 'debtchaser_invoices',
  SETTINGS: 'debtchaser_settings',
  ONBOARDING: 'debtchaser_onboarding_complete',
  ENCRYPTION_KEY: 'debtchaser_encryption_key',
};

export const VALIDATION_RULES = {
  MIN_AMOUNT: 0.01,
  MAX_AMOUNT: 10_000_000,
  MIN_CLIENT_NAME_LENGTH: 2,
  MAX_CLIENT_NAME_LENGTH: 100,
  MAX_PHONE_LENGTH: 20,
};

export const TIME_CONSTANTS = {
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  STORAGE_TIMEOUT_MS: 2500,
  DEBOUNCE_DELAY_MS: 500,
  NOTIFICATION_CHECK_INTERVAL_MS: 60000, // 1 minute
};

export const ONBOARDING_STEPS = [
  {
    title: "Stop Chasing.",
    subtitle: "Start Collecting.",
    description: "Unpaid invoices are the silent killer of small businesses. Debt Chaser is your automated recovery partner.",
    icon: "DollarSign",
    color: "blue"
  },
  {
    title: "Smart Copy.",
    subtitle: "One-Tap Reminders.",
    description: "Generate professional WhatsApp reminders in seconds. Just copy, paste, and get paid.",
    icon: "MessageSquare",
    color: "emerald"
  },
  {
    title: "Live Insights.",
    subtitle: "Know Your Cash.",
    description: "See exactly who owes you, how long they've been dodging, and your total recovery rate.",
    icon: "TrendingUp",
    color: "purple"
  }
];
