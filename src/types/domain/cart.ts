/**
 * Cart Domain Types
 * Centralized type definitions for cart and cart line items
 */

import type { Database } from "@/integrations/supabase/types";

// Cart line with all possible fields from database and hydrated relationships
export interface CartLine {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number | null;
  patient_name: string;
  patient_id: string | null;
  patient_email?: string | null;
  patient_email_encrypted?: string | null;
  patient_phone?: string | null;
  patient_phone_encrypted?: string | null;
  patient_address?: string | null;
  patient_address_encrypted?: string | null;
  patient_address_formatted?: string | null;
  patient_address_street?: string | null;
  patient_address_city?: string | null;
  patient_address_state?: string | null;
  patient_address_zip?: string | null;
  patient_address_validated?: boolean | null;
  patient_address_validation_source?: string | null;
  price_snapshot: number | null;
  shipping_speed: Database["public"]["Enums"]["shipping_speed"] | null;
  destination_state: string;
  custom_dosage?: string | null;
  custom_dosage_encrypted?: string | null;
  custom_sig?: string | null;
  custom_sig_encrypted?: string | null;
  prescription_url?: string | null;
  prescription_url_encrypted?: string | null;
  prescription_method?: string | null;
  assigned_pharmacy_id?: string | null;
  provider_id?: string | null;
  order_notes?: string | null;
  gender_at_birth?: string | null;
  refills_allowed?: boolean | null;
  refills_total?: number | null;
  refills_remaining?: number | null;
  expires_at?: string | null;
  created_at?: string | null;
  variant_id?: string | null; // NEW: Product variant ID for dosage selection
  days_supply?: number | null; // Days supply for pharmacy
  ship_to?: string | null; // 'practice' or 'patient' - determines shipping destination

  // Hydrated relationships (optional - may be joined)
  product?: {
    id: string;
    name: string;
    description?: string | null;
    price?: number | null;
    category?: string | null;
    active?: boolean;
    requires_prescription?: boolean;
    dosage?: string | null;
    [key: string]: unknown;
  };
  
  // NEW: Hydrated variant data
  variant?: {
    id: string;
    dosage_label: string;
    retail_price?: number | null;
  } | null;
  
  patient_accounts?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    [key: string]: unknown;
  };
}

// Cart with lines
export interface Cart {
  id: string;
  doctor_id?: string;
  created_at?: string | null;
  updated_at?: string | null;
  lines: CartLine[];
}

// Type guard for checking if a cart line is a practice order
export function isPracticeOrder(line: CartLine): boolean {
  return line.ship_to === 'practice' || !line.patient_name || line.patient_name === "Practice Order";
}

// Type guard for checking if cart line has prescription
export function hasPrescription(line: CartLine): boolean {
  return !!line.prescription_url || !!line.prescription_url_encrypted;
}
