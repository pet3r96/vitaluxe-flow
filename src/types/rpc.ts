/**
 * RPC Function Type Definitions
 * Type-safe interfaces for Supabase RPC (Remote Procedure Call) functions
 */

// get_orders_by_status RPC
export interface GetOrdersByStatusParams {
  p_user_id: string;
  p_role?: string | null;
  p_practice_id?: string | null;
  p_start_date?: string | null;
  p_end_date?: string | null;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

// get_user_rep_id RPC
export interface GetUserRepIdParams {
  _user_id: string;
}

// get_encryption_coverage RPC
export interface EncryptionCoverageRow {
  data_type: string;
  total: number;
  encrypted: number;
  percentage: number;
}

// Complex query result interfaces
export interface ThreadMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  message_type?: string | null;
  metadata?: unknown | null;
  sender_type?: string;
  practice_id?: string;
  patient_id?: string;
  subject?: string;
  patient?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  sender?: {
    name: string;
    email?: string;
  } | null;
}

export interface RepProductivityRow {
  rep_id: string;
  rep_name: string;
  rep_email: string;
  rep_role: string;
  practice_count: number;
  downline_count: number;
  non_rx_orders: number;
  rx_orders: number;
  total_orders: number;
  total_revenue: number;
  total_commissions?: number;
  avg_order_value: number;
}

export interface SupportTicketRow {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  resolved_at?: string | null;
  user?: {
    name: string;
    email: string;
  } | null;
}

export interface PracticeWithPharmacy {
  id: string;
  name: string;
  email: string;
  assigned_pharmacy?: {
    id: string;
    pharmacy_name: string;
  } | null;
}
