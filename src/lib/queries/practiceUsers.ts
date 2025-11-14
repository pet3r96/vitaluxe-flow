/**
 * Unified Practice Users Queries
 * Provides standardized queries for the new unified user model
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch practice users with full credentials
 * Replaces old providers + practice_staff queries
 */
export const fetchPracticeUsersWithCredentials = async (practiceId: string) => {
  const { data, error } = await supabase
    .from('practice_users')
    .select(`
      id,
      practice_id,
      user_id,
      role_in_practice,
      can_order,
      is_primary,
      active,
      created_at,
      users (
        id,
        email,
        first_name,
        last_name,
        full_name,
        phone,
        status
      ),
      provider_credentials (
        npi,
        dea,
        license_number,
        license_state,
        specialties,
        prescriber_name
      )
    `)
    .eq('practice_id', practiceId)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

/**
 * Fetch providers only (with credentials)
 */
export const fetchProvidersWithCredentials = async (practiceId: string) => {
  const { data, error } = await supabase
    .from('practice_users')
    .select(`
      id,
      practice_id,
      user_id,
      can_order,
      is_primary,
      active,
      users (
        id,
        email,
        first_name,
        last_name,
        full_name,
        phone
      ),
      provider_credentials (
        npi,
        dea,
        license_number,
        license_state,
        prescriber_name
      )
    `)
    .eq('practice_id', practiceId)
    .eq('role_in_practice', 'PROVIDER')
    .eq('active', true);

  if (error) throw error;
  return data;
};

/**
 * Fetch staff only
 */
export const fetchStaff = async (practiceId: string) => {
  const { data, error } = await supabase
    .from('practice_users')
    .select(`
      id,
      practice_id,
      user_id,
      can_order,
      active,
      users (
        id,
        email,
        first_name,
        last_name,
        full_name,
        phone
      )
    `)
    .eq('practice_id', practiceId)
    .eq('role_in_practice', 'STAFF')
    .eq('active', true);

  if (error) throw error;
  return data;
};

/**
 * Get user's practice associations
 */
export const fetchUserPractices = async (userId: string) => {
  const { data, error } = await supabase
    .from('practice_users')
    .select(`
      id,
      practice_id,
      role_in_practice,
      can_order,
      active,
      practices (
        id,
        name,
        npi,
        dea,
        license_number,
        address_street,
        address_city,
        address_state,
        address_zip,
        phone,
        email,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('active', true);

  if (error) throw error;
  return data;
};

/**
 * Check if user has provider credentials
 */
export const fetchProviderCredentials = async (userId: string) => {
  const { data, error } = await supabase
    .from('provider_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

/**
 * Get practice by legacy profile ID (for migration compatibility)
 */
export const fetchPracticeByLegacyId = async (legacyProfileId: string) => {
  // Try new practices table first
  const { data: newPractice, error: newError } = await supabase
    .from('practices')
    .select('*')
    .or(`id.eq.${legacyProfileId},legacy_profile_id.eq.${legacyProfileId}`)
    .maybeSingle();

  if (newPractice && !newError) {
    return newPractice;
  }

  // Fallback to profiles table
  const { data: legacyPractice, error: legacyError } = await supabase
    .from('profiles')
    .select('id, name, npi, dea, license_number, address, phone, email')
    .eq('id', legacyProfileId)
    .maybeSingle();

  if (legacyError) throw legacyError;
  
  // Map to new structure
  return {
    id: legacyPractice.id,
    legacy_profile_id: legacyPractice.id,
    name: legacyPractice.name,
    npi: legacyPractice.npi,
    dea: legacyPractice.dea,
    license_number: legacyPractice.license_number,
    address_street: legacyPractice.address,
    phone: legacyPractice.phone,
    email: legacyPractice.email
  };
};

/**
 * Validate provider has required credentials for RX ordering
 */
export const validateProviderForRx = async (userId: string): Promise<{
  valid: boolean;
  missingFields: string[];
}> => {
  const credentials = await fetchProviderCredentials(userId);
  
  if (!credentials) {
    return {
      valid: false,
      missingFields: ['All credentials missing']
    };
  }

  const missingFields: string[] = [];
  if (!credentials.npi) missingFields.push('NPI');
  if (!credentials.license_number) missingFields.push('License Number');

  return {
    valid: missingFields.length === 0,
    missingFields
  };
};
