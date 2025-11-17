/**
 * Order Domain Types
 * Centralized type definitions for order-related data structures
 */

import type { Database } from "@/integrations/supabase/types";

export interface OrderQueryMetadata {
  hasRepRecord: boolean;
  practiceCount: number;
  practiceNames: string[];
  isEmpty: boolean;
  emptyReason: 'no_rep' | 'no_practices' | 'no_orders' | null;
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

// ============= Detailed Order Line Types =============

// Order line with all possible fields and relationships
export interface OrderLine {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number | null;
  price: number;
  price_before_discount?: number | null;
  discount_amount?: number | null;
  discount_percentage?: number | null;
  patient_name: string;
  patient_id: string | null;
  patient_email?: string | null;
  patient_email_encrypted?: string | null;
  patient_phone?: string | null;
  patient_phone_encrypted?: string | null;
  patient_address?: string | null;
  patient_address_encrypted?: string | null;
  destination_state?: string | null;
  shipping_speed: Database["public"]["Enums"]["shipping_speed"];
  shipping_cost?: number | null;
  shipping_carrier?: Database["public"]["Enums"]["shipping_carrier"] | null;
  tracking_number?: string | null;
  status: Database["public"]["Enums"]["order_status"] | null;
  custom_dosage?: string | null;
  custom_dosage_encrypted?: string | null;
  custom_sig?: string | null;
  custom_sig_encrypted?: string | null;
  prescription_url?: string | null;
  prescription_url_encrypted?: string | null;
  prescription_method?: string | null;
  assigned_pharmacy_id?: string | null;
  pharmacy_order_id?: string | null;
  pharmacy_order_metadata?: Record<string, unknown> | null;
  provider_id?: string | null;
  order_notes?: string | null;
  gender_at_birth?: string | null;
  refills_allowed?: boolean | null;
  refills_total?: number | null;
  refills_remaining?: number | null;
  refill_number?: number | null;
  is_refill?: boolean | null;
  original_order_line_id?: string | null;
  processing_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  created_at: string | null;
  updated_at: string | null;
  
  // Hydrated relationships (optional)
  products?: {
    id: string;
    name: string;
    description?: string | null;
    price?: number | null;
    category?: string | null;
    requires_prescription?: boolean;
    [key: string]: unknown;
  };
  
  pharmacies?: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  
  providers?: {
    id: string;
    full_name?: string | null;
    [key: string]: unknown;
  };
}

// Order with lines and relationships
export interface Order {
  id: string;
  doctor_id: string;
  practice_id?: string | null;
  total_amount: number;
  subtotal_before_discount?: number | null;
  discount_amount?: number | null;
  discount_code?: string | null;
  discount_percentage?: number | null;
  shipping_total?: number | null;
  merchant_fee_amount?: number | null;
  merchant_fee_percentage?: number | null;
  payment_method_id?: string | null;
  payment_method_used?: string | null;
  payment_status?: string | null;
  status?: string | null;
  status_manual_override?: boolean | null;
  status_override_reason?: string | null;
  shipping_verification_status?: string | null;
  ship_to?: string | null;
  formatted_shipping_address?: string | null;
  practice_address?: string | null;
  report_notes?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  stripe_payment_id?: string | null;
  authorizenet_transaction_id?: string | null;
  authorizenet_profile_id?: string | null;
  total_refunded_amount: number;
  created_at: string | null;
  updated_at: string | null;
  
  // Relationships
  order_lines?: OrderLine[];
  profiles?: {
    id: string;
    name?: string | null;
    email?: string;
    [key: string]: unknown;
  };
}

// Type guard for checking if order line is assigned to pharmacy
export function isAssignedToPharmacy(line: OrderLine): boolean {
  return !!line.assigned_pharmacy_id;
}

// Type guard for checking if order line belongs to specific pharmacy
export function belongsToPharmacy(line: OrderLine, pharmacyId: string): boolean {
  return line.assigned_pharmacy_id === pharmacyId;
}

// Type guard for checking if order line is for provider
export function isProviderOrderLine(line: OrderLine, providerId: string): boolean {
  return line.provider_id === providerId;
}
