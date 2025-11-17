/**
 * Type definitions for complex database queries
 */

import type { Database } from '@/integrations/supabase/types';

/**
 * Patient account with basic info
 */
export type PatientAccount = Database['public']['Tables']['patient_accounts']['Row'];

/**
 * Provider with user information
 */
export interface ProviderWithUser {
  id: string;
  user_id: string;
  full_name: string | null;
  specialty: string | null;
  license_number: string | null;
  is_active: boolean;
}

/**
 * Active session information
 */
export interface ActiveSession {
  id: string;
  last_activity: string;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Provider statistics for performance reports
 */
export interface ProviderStats {
  provider_id: string;
  provider_name: string;
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

/**
 * Cart line with product and patient information
 */
export interface CartLineItem {
  id: string;
  product_id: string;
  quantity: number | null;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  custom_dosage: string | null;
  custom_sig: string | null;
  price_snapshot: number | null;
  [key: string]: unknown;
}
