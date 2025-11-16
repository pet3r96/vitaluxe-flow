/**
 * Patient Medical Data Service
 * Handles fetching patient medical records including medications, conditions, allergies, etc.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PatientMedicalData } from "@/types/domain/patients";

export async function fetchPatientMedicalData(patientId: string): Promise<PatientMedicalData> {
  const { data: account, error: accountError } = await supabase
    .from("patient_accounts")
    .select("*")
    .eq("id", patientId)
    .maybeSingle();
  
  if (accountError) throw accountError;
  if (!account) throw new Error("Patient not found or you don't have access");

  // Fetch all medical vault records
  const { data: vaultRecords } = await supabase
    .from("patient_medical_vault")
    .select("*")
    .eq("patient_account_id", patientId)
    .order("created_at", { ascending: false })
    .limit(200);

  // Group records by type
  const medications = vaultRecords?.filter(r => r.record_type === 'medication').slice(0, 50) || [];
  const conditions = vaultRecords?.filter(r => r.record_type === 'condition').slice(0, 50) || [];
  const allergies = vaultRecords?.filter(r => r.record_type === 'allergy').slice(0, 50) || [];
  const vitals = vaultRecords?.filter(r => r.record_type === 'vital').slice(0, 20) || [];
  const immunizations = vaultRecords?.filter(r => r.record_type === 'immunization').slice(0, 20) || [];
  const surgeries = vaultRecords?.filter(r => r.record_type === 'surgery').slice(0, 20) || [];
  const pharmacies = vaultRecords?.filter(r => r.record_type === 'pharmacy').slice(0, 10) || [];
  const emergencyContacts = vaultRecords?.filter(r => r.record_type === 'emergency_contact').slice(0, 5) || [];

  return {
    account,
    medications,
    conditions,
    allergies,
    vitals,
    immunizations,
    surgeries,
    pharmacies,
    emergencyContacts,
  };
}
