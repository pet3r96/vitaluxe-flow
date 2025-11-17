import type { Database } from "@/integrations/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderLineRow = Database["public"]["Tables"]["order_lines"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type PharmacyRow = Database["public"]["Tables"]["pharmacies"]["Row"];
type ProviderRow = Database["public"]["Tables"]["providers"]["Row"];

// ============= Base References =============

export interface ProfileRef {
  id: string;
  name: string;
  email?: string;
  prescriber_name?: string;
  full_name?: string;
}

export interface PharmacyRef {
  id: string;
  name: string;
  email?: string;
}

export interface ProviderRef {
  id: string;
  name: string;
  npi?: string | null;
  practice_id?: string;
}

// ============= Order Line Types =============

export interface OrderLine extends OrderLineRow {
  products?: ProductRow;
  assigned_pharmacy?: PharmacyRef | null;
  provider?: ProviderRef | null;
  providers?: ProviderRef | null; // Legacy alias
}

// ============= Order Types =============

export interface Order extends OrderRow {
  order_lines?: OrderLine[];
  doctor?: ProfileRef;
  practice?: ProfileRef;
  profiles?: ProfileRef;
  practice_payment_methods?: {
    id: string;
    payment_type: string;
    is_default: boolean;
    card_type?: string;
    card_last_five?: string;
    card_expiry?: string;
  };
}

// ============= Shipping & Tracking =============

export interface ShippingAuditLogEntry {
  id: string;
  order_line_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  updated_by: string | null;
  new_tracking_number?: string | null;
  change_description?: string;
  created_at: string;
  updated_by_profile?: {
    name: string;
  } | null;
}

export interface TrackingEvent {
  id?: string;
  order_line_id?: string;
  event_time?: string;
  datetime: string;
  status: string;
  message: string;
  description?: string;
  location?: string;
  tracking_code?: string;
  carrier?: string;
  tracking_details?: TrackingDetails;
  created_at?: string;
}

export interface TrackingDetails {
  status?: string;
  location?: string;
  carrier?: string;
  estimated_delivery?: string;
  events?: Array<{
    datetime: string;
    status: string;
    message: string;
    description?: string;
    location?: string;
  }>;
}

// ============= Refunds =============

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

// ============= Legacy Compatibility =============

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
