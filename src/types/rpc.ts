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
