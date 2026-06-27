export type DueTodaySourceApp = 'solobid' | 'rentease' | 'radflow' | 'duetoday';

export type DueTodayActionStatus = 'open' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
export type DueTodayActionPriority = 'low' | 'medium' | 'high' | 'critical';

export type DueTodayActionCategory =
  | 'quote_follow_up'
  | 'invoice_follow_up'
  | 'payment_chase'
  | 'rent_collection'
  | 'lease_renewal'
  | 'maintenance_follow_up'
  | 'appointment_follow_up'
  | 'study_review'
  | 'report_approval'
  | 'billing_follow_up'
  | 'admin_task';

export interface DueTodayAction {
  id: string;
  external_key: string;
  source_app: DueTodaySourceApp;
  source_table: string;
  source_id: string;
  owner_id: string | null;
  organization_id: string | null;
  title: string;
  description: string | null;
  category: DueTodayActionCategory;
  priority: DueTodayActionPriority;
  status: DueTodayActionStatus;
  due_date: string;
  money_value: number | null;
  currency: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SoloBidDueTodayActionContext {
  userId: string;
  organizationId?: string | null;
  baseUrl?: string;
  now?: Date;
  quoteFollowUpDays?: number;
}
