/**
 * Typed View Accessor Helpers
 * Provides type-safe access to Supabase database views
 */

import { supabase } from './client';
import type { Database } from './types';

/**
 * Generic helper to get a typed view ref
 */
function view<T>(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(name as any) as any;
}

// Named view accessors for database views that exist in schema
export const ProfilesMaskedForReps = () =>
  view<Database['public']['Views']['profiles_masked_for_reps']['Row']>('profiles_masked_for_reps');

export const PatientAccountHealth = () =>
  view<Database['public']['Views']['patient_account_health']['Row']>('patient_account_health');

export const VPatientsWithPortalStatus = () =>
  view<Database['public']['Views']['v_patients_with_portal_status']['Row']>('v_patients_with_portal_status');

export const CartLinesMasked = () =>
  view<Database['public']['Views']['cart_lines_masked']['Row']>('cart_lines_masked');

