/**
 * Database Extensions Types
 * Local type definitions for tables missing from generated Supabase types
 */

export interface MedicalVaultShareLink {
  id: string;
  patient_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  accessed_at: string | null;
  access_count: number;
  is_active: boolean;
}

export interface OrderRefund {
  id: string;
  order_id: string;
  refund_amount: number;
  refund_type: 'full' | 'partial';
  refund_status: 'pending' | 'approved' | 'rejected';
  refund_reason: string | null;
  refund_transaction_id: string | null;
  refunded_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    name: string;
    email: string;
  };
}

export interface ShippingAuditLog {
  id: string;
  order_id: string;
  order_line_id: string;
  event_type: string;
  event_data: any;
  created_at: string;
  created_by: string | null;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  expires_at: string;
  created_at: string;
}

export interface PatientNote {
  id: string;
  patient_account_id: string;
  note_content: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_role: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
