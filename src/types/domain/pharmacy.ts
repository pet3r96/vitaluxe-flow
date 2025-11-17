/**
 * Pharmacy Domain Types
 */

import type { Database } from '@/integrations/supabase/types';

export type PharmacyOrderTransmission = Database['public']['Tables']['pharmacy_order_transmissions']['Row'];
export type Pharmacy = Database['public']['Tables']['pharmacies']['Row'];

/**
 * Pharmacy order transmission with joined pharmacy data
 */
export interface PharmacyOrderTransmissionWithRelations extends PharmacyOrderTransmission {
  pharmacies: {
    id: string;
    name: string;
  } | null;
}

/**
 * Transmission type enum
 */
export type TransmissionType = 'order' | 'update' | 'cancel' | 'status_check';

/**
 * Transmission status
 */
export interface TransmissionStatus {
  success: boolean;
  error_message?: string | null;
  response_code?: string | null;
}
