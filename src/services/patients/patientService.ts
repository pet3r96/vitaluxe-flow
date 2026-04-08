/**
 * Patient Service
 * Handles fetching patient account data with role-based access control
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { PatientQueryParams } from "@/types/domain/patients";

export async function fetchPatients(params: PatientQueryParams) {
  const { effectiveRole, effectivePracticeId } = params;
  
  logger.info('Patients query params', logger.sanitize({ effectiveRole, effectivePracticeId }));
  
  const columns = "id, name, first_name, last_name, email, phone, gender_at_birth, address, address_street, address_suite, address_city, address_state, address_zip, address_formatted, city, state, zip_code, birth_date, date_of_birth, allergies, notes, address_verification_status, address_verification_source, practice_id, provider_id, created_at, user_id, last_login_at, status, practice:practice_id(name, address_city, address_state)";

  let patientsData: Array<Record<string, unknown>> = [];

  if ((effectiveRole === "doctor" || effectiveRole === "provider" || effectiveRole === "staff") && effectivePracticeId) {
    // OPTIMIZED: Single RPC call replaces 3 sequential queries (2-3x faster)
    const { data, error } = await supabase.rpc('get_practice_patients', {
      p_practice_id: effectivePracticeId
    });

    if (error) {
      logger.error("Error fetching patients for practice", error);
      throw error;
    }

    // Transform RPC result to match expected format
    patientsData = (data || []).map((row: any) => ({
      ...row,
      practice: row.practice_name ? {
        name: row.practice_name,
        address_city: row.practice_city,
        address_state: row.practice_state
      } : null
    }));
  } else if (effectiveRole === "admin") {
    // Admins see all patients
    const { data, error } = await supabase
      .from("patient_accounts")
      .select(columns)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching all patients for admin", error);
      throw error;
    }
    patientsData = data || [];
  }

  return patientsData;
}
