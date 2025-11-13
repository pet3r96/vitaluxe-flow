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

  const [medications, conditions, allergies, vitals, immunizations, surgeries, pharmacies, emergencyContacts] = await Promise.all([
    supabase.from("patient_medications").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
    supabase.from("patient_conditions").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
    supabase.from("patient_allergies").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
    supabase.from("patient_vitals").select("*").eq("patient_account_id", patientId).order("date_recorded", { ascending: false }),
    supabase.from("patient_immunizations").select("*").eq("patient_account_id", patientId).order("date_administered", { ascending: false }),
    supabase.from("patient_surgeries").select("*").eq("patient_account_id", patientId).order("surgery_date", { ascending: false }),
    supabase.from("patient_pharmacies").select("*").eq("patient_account_id", patientId).order("is_preferred", { ascending: false }),
    supabase.from("patient_emergency_contacts").select("*").eq("patient_account_id", patientId).order("contact_order", { ascending: true }),
  ]);

  return {
    account,
    medications: medications.data || [],
    conditions: conditions.data || [],
    allergies: allergies.data || [],
    vitals: vitals.data || [],
    immunizations: immunizations.data || [],
    surgeries: surgeries.data || [],
    pharmacies: pharmacies.data || [],
    emergencyContacts: emergencyContacts.data || [],
  };
}
