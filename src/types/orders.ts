import type { Database } from "@/integrations/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderLineRow = Database["public"]["Tables"]["order_lines"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];

export interface ProfileRef {
  id: string;
  name: string;
  email?: string;
}

export interface OrderRefund {
  id: string;
  order_id: string;
  refund_amount: number;
  refund_reason: string | null;
  refund_status?: string | null;
  refund_type?: string | null;
  refunded_by: string | null;
  refund_transaction_id: string | null;
  created_at: string;
  profiles?: ProfileRef;
}

export interface ShippingAuditLogEntry {
  id: string;
  order_line_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  updated_by: string | null;
  created_at: string;
  updated_by_profile?: {
    name: string;
  } | null;
}

export interface TrackingEvent {
  id?: string;
  order_line_id?: string;
  event_time?: string;
  datetime?: string;
  status?: string;
  message?: string;
  location?: string;
  tracking_code?: string;
  created_at?: string;
}

export interface OrderLineWithProduct extends OrderLineRow {
  products?: ProductRow;
}

export interface OrderWithLines extends OrderRow {
  order_lines?: OrderLineWithProduct[];
  doctor?: ProfileRef;
  practice?: ProfileRef;
}

export interface CartLine {
  id: string;
  cart_id: string;
  product_id: string;
  patient_name: string;
  quantity?: number | null;
  price_snapshot?: number | null;
  destination_state: string;
  products?: ProductRow;
}

export interface Cart {
  id: string;
  doctor_id: string;
  created_at: string | null;
  updated_at: string | null;
  cart_lines?: CartLine[];
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
  changed_by_role: string;
  change_reason: string | null;
  is_manual_override: boolean | null;
  metadata: unknown;
  created_at: string;
}
