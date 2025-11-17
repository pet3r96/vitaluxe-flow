/**
 * Type-safe Medical Vault Insert Utilities
 * Provides strongly-typed wrappers for patient_medical_vault inserts
 * to avoid "Type instantiation is excessively deep" errors
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Specific record data types for each vault record type
export interface AllergyRecordData {
  allergen_name?: string;
  reaction_type?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  date_recorded?: string;
  notes?: string;
  nka?: boolean;
  is_active?: boolean;
}

export interface MedicationRecordData {
  medication_name?: string;
  dosage?: string;
  frequency?: string;
  start_date?: string;
  stop_date?: string;
  notes?: string;
  instructions?: string;
  alert_enabled?: boolean;
  prescribing_provider?: string;
  is_active?: boolean;
}

export interface ConditionRecordData {
  condition_name?: string;
  description?: string;
  date_diagnosed?: string;
  severity?: string;
  treatment_plan?: string;
  associated_provider?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PharmacyRecordData {
  name?: string;
  pharmacy_name?: string;
  npi?: string;
  phone?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  is_preferred?: boolean;
  notes?: string;
}

export interface EmergencyContactRecordData {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
  preferred_contact_method?: string;
  is_primary?: boolean;
}

export interface ImmunizationRecordData {
  vaccine?: string;
  vaccine_name?: string;
  date_administered?: string;
  lot_number?: string;
  administered_by?: string;
  notes?: string;
}

export interface SurgeryRecordData {
  procedure?: string;
  surgery_type?: string;
  surgery_date?: string;
  date?: string;
  surgeon?: string;
  facility?: string;
  notes?: string;
}

export interface VitalsRecordData {
  vital_type?: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  pulse?: number;
  temperature?: number;
  temperature_unit?: string;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight?: number;
  weight_unit?: string;
  height?: number;
  height_unit?: string;
  bmi?: number;
  cholesterol?: number;
  blood_sugar?: number;
  date_recorded?: string;
  notes?: string;
}

// Base insert payload (common fields)
interface BaseVaultInsert {
  patient_account_id: string;
  created_by_user_id?: string;
  created_by_role?: string;
  is_active?: boolean;
  title: string;
  patient_id: string;
}

// Type-specific insert payloads
export type AllergyInsert = BaseVaultInsert & {
  record_type: 'allergy';
  record_data: AllergyRecordData;
};

export type MedicationInsert = BaseVaultInsert & {
  record_type: 'medication';
  record_data: MedicationRecordData;
};

export type ConditionInsert = BaseVaultInsert & {
  record_type: 'condition';
  record_data: ConditionRecordData;
};

export type PharmacyInsert = BaseVaultInsert & {
  record_type: 'pharmacy';
  record_data: PharmacyRecordData;
};

export type EmergencyContactInsert = BaseVaultInsert & {
  record_type: 'emergency_contact';
  record_data: EmergencyContactRecordData;
};

export type ImmunizationInsert = BaseVaultInsert & {
  record_type: 'immunization';
  record_data: ImmunizationRecordData;
};

export type SurgeryInsert = BaseVaultInsert & {
  record_type: 'surgery';
  record_data: SurgeryRecordData;
};

export type VitalsInsert = BaseVaultInsert & {
  record_type: 'vitals';
  record_data: VitalsRecordData;
};

// Union type for all inserts
export type VaultInsert =
  | AllergyInsert
  | MedicationInsert
  | ConditionInsert
  | PharmacyInsert
  | EmergencyContactInsert
  | ImmunizationInsert
  | SurgeryInsert
  | VitalsInsert;

/**
 * Type-safe insert into patient_medical_vault
 * Avoids deep instantiation errors by using proper narrowed types
 */
export async function insertVaultRecord(
  supabase: SupabaseClient<Database>,
  payload: VaultInsert
) {
  const { error } = await supabase
    .from('patient_medical_vault')
    .insert({
      record_type: payload.record_type,
      record_data: payload.record_data as any, // Cast only at DB boundary
      patient_account_id: payload.patient_account_id,
      patient_id: payload.patient_id,
      title: payload.title,
      created_by_user_id: payload.created_by_user_id,
      created_by_role: payload.created_by_role,
      is_active: payload.is_active ?? true,
    });

  return { error };
}

/**
 * Type-safe update for patient_medical_vault
 */
export async function updateVaultRecord(
  supabase: SupabaseClient<Database>,
  id: string,
  payload: Partial<VaultInsert>
) {
  const updateData: any = {
    ...(payload.record_data && { record_data: payload.record_data }),
    ...(payload.is_active !== undefined && { is_active: payload.is_active }),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('patient_medical_vault')
    .update(updateData)
    .eq('id', id);

  return { error };
}
