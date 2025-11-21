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
  is_active?: boolean;
  title: string;
  practice_id?: string; // Optional - will be auto-fetched if not provided
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
  record_type: 'procedure';
  record_data: SurgeryRecordData;
};

export type VitalsInsert = BaseVaultInsert & {
  record_type: 'vital_sign';
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
  // Auto-fetch practice_id if not provided
  let practiceId = payload.practice_id;
  if (!practiceId) {
    const { data } = await supabase
      .from("patient_accounts")
      .select("practice_id")
      .eq("id", payload.patient_account_id)
      .single();
    practiceId = data?.practice_id;
  }
  
  if (!practiceId) {
    throw new Error("Could not determine practice_id for vault record");
  }

  // ✅ AUTHORIZATION CHECK: Verify user has access to this practice
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (!authUser || authError) {
    throw new Error("Not authenticated");
  }

  // ✅ PATIENT ROLE CHECK - Allow patient to add to their own vault
  const { data: patientCheck } = await supabase
    .from('patient_accounts')
    .select('id')
    .eq('id', payload.patient_account_id)
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (patientCheck) {
    // Patient owns this vault - allow insert
    console.log('[MEDICAL_VAULT] Patient authorized for own vault');
  } else {
    // Check if user is practice owner, provider, or staff for this practice
    const isPracticeOwner = authUser.id === practiceId;
    
    if (!isPracticeOwner) {
      const { data: providerCheck } = await supabase
        .from('providers')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('practice_id', practiceId)
        .eq('active', true)
        .maybeSingle();

      const { data: staffCheck } = await supabase
        .from('practice_staff')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('practice_id', practiceId)
        .eq('active', true)
        .maybeSingle();

      if (!providerCheck && !staffCheck) {
        throw new Error(
          'You are not authorized to add medical records for this practice. ' +
          'Please contact your practice administrator if you believe this is an error.'
        );
      }
    }
  }

  console.log('[MEDICAL_VAULT] INSERT starting', {
    timestamp: new Date().toISOString(),
    record_type: payload.record_type,
    patient_account_id: payload.patient_account_id,
    practice_id: practiceId,
    title: payload.title,
    active: payload.is_active ?? true,
    created_by_user_id: payload.created_by_user_id
  });
  
  const { error } = await supabase
    .from('patient_medical_vault')
    .insert({
      record_type: payload.record_type,
      record_data: payload.record_data as any, // Cast only at DB boundary
      patient_account_id: payload.patient_account_id,
      patient_id: payload.patient_account_id, // ✅ PATIENT FIX: Use patient_account_id for patient_id
      practice_id: practiceId,
      title: payload.title,
      created_by_user_id: payload.created_by_user_id,
      active: payload.is_active ?? true,
    });

  console.log('[MEDICAL_VAULT] INSERT completed', {
    timestamp: new Date().toISOString(),
    success: !error,
    record_type: payload.record_type,
    patient_account_id: payload.patient_account_id,
    active: payload.is_active ?? true,
    error: error?.message
  });

  if (error) {
    console.error('[MEDICAL_VAULT] INSERT failed', {
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      record_type: payload.record_type
    });
    throw new Error(error.message || 'Failed to insert vault record');
  }

  return { error: null };
}

/**
 * Type-safe update for patient_medical_vault
 */
export async function updateVaultRecord(
  supabase: SupabaseClient<Database>,
  id: string,
  payload: Partial<VaultInsert>
) {
  console.log('[MEDICAL_VAULT] UPDATE starting', {
    timestamp: new Date().toISOString(),
    record_id: id,
    has_record_data: !!payload.record_data,
    has_title: !!payload.title,
    active: payload.is_active
  });

  const updateData: any = {
    ...(payload.record_data && { record_data: payload.record_data }),
    ...(payload.is_active !== undefined && { active: payload.is_active }), // ✅ FIX: Use 'active' column name
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('patient_medical_vault')
    .update(updateData)
    .eq('id', id);

  console.log('[MEDICAL_VAULT] UPDATE completed', {
    timestamp: new Date().toISOString(),
    success: !error,
    record_id: id,
    error: error?.message
  });

  if (error) {
    console.error('[MEDICAL_VAULT] UPDATE failed', {
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      record_id: id
    });
    throw new Error(error.message || 'Failed to update vault record');
  }

  return { error: null };
}
