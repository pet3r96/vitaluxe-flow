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
  
  const columns = "id, name, first_name, last_name, email, phone, gender_at_birth, address, address_street, address_city, address_state, address_zip, address_formatted, city, state, zip_code, birth_date, date_of_birth, allergies, notes, address_verification_status, address_verification_source, practice_id, provider_id, created_at, user_id, last_login_at, status";

  let patientsData: any[] = [];

  if ((effectiveRole === "doctor" || effectiveRole === "provider" || effectiveRole === "staff") && effectivePracticeId) {
    // 1) Patients explicitly assigned to this practice
    const { data: byPractice, error: byPracticeErr } = await supabase
      .from("patient_accounts")
      .select(columns)
      .eq("practice_id", effectivePracticeId)
      .order("created_at", { ascending: false });

    if (byPracticeErr) {
      logger.error("Error fetching patients by practice", byPracticeErr);
      throw byPracticeErr;
    }
    patientsData = byPractice || [];

    // 2) Also include patients assigned to providers that belong to this practice
    const { data: providerRows } = await supabase
      .from("providers")
      .select("id")
      .eq("practice_id", effectivePracticeId);

    const providerIds = (providerRows || []).map(p => p.id);
    if (providerIds.length > 0) {
      const { data: byProvider, error: byProviderErr } = await supabase
        .from("patient_accounts")
        .select(columns)
        .in("provider_id", providerIds)
        .order("created_at", { ascending: false });

      if (byProviderErr) {
        logger.error("Error fetching patients by provider", byProviderErr);
        throw byProviderErr;
      }

      // Merge, avoiding duplicates
      const existingIds = new Set(patientsData.map(p => p.id));
      for (const p of byProvider || []) {
        if (!existingIds.has(p.id)) {
          patientsData.push(p);
        }
      }
    }
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
