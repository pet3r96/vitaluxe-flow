/**
 * Patient Medical Data Service
 * Handles fetching patient medical records including medications, conditions, allergies, etc.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PatientMedicalData } from "@/types/domain/patients";

export async function fetchPatientMedicalData(patientId: string): Promise<PatientMedicalData> {
  // OPTIMIZED: Parallel fetch of account + grouped vault data (3x faster)
  const [accountResult, vaultResult] = await Promise.all([
    supabase
      .from("patient_accounts")
      .select("*")
      .eq("id", patientId)
      .maybeSingle(),
    supabase.rpc('get_patient_vault_grouped', {
      p_patient_account_id: patientId
    })
  ]);
  
  if (accountResult.error) throw accountResult.error;
  if (!accountResult.data) throw new Error("Patient not found or you don't have access");
  
  if (vaultResult.error) throw vaultResult.error;

  // RPC returns pre-grouped data, no JS filtering needed
  const vaultData = (vaultResult.data || {}) as any;

  return {
    account: accountResult.data,
    medications: (vaultData.medications || []) as any,
    conditions: (vaultData.conditions || []) as any,
    allergies: (vaultData.allergies || []) as any,
    vitals: (vaultData.vitals || []) as any,
    immunizations: (vaultData.immunizations || []) as any,
    surgeries: (vaultData.surgeries || []) as any,
    pharmacies: (vaultData.pharmacies || []) as any,
    emergencyContacts: (vaultData.emergency_contacts || []) as any,
  };
}
