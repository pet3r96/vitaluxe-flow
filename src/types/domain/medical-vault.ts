/**
 * Medical Vault Domain Types
 * Discriminated unions for JSONB record_data fields in patient_medical_vault table
 */

// Base record interface
export interface BaseRecordData {
  created_at?: string;
  updated_at?: string;
}

// Allergy record data
export interface AllergyRecordData extends BaseRecordData {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
  onset_date?: string;
  notes?: string;
  nka?: boolean; // No Known Allergies flag
  vios_code?: number; // VIOS pharmacy allergy code
}

// Medication record data
export interface MedicationRecordData extends BaseRecordData {
  medication_name: string;
  dosage: string;
  frequency: string;
  route?: string;
  start_date: string;
  stop_date?: string;
  stop_date_option?: string;
  prescriber?: string;
  pharmacy?: string;
  reason?: string;
  notes?: string;
  is_current?: boolean;
}

// Condition record data
export interface ConditionRecordData extends BaseRecordData {
  condition_name: string;
  diagnosis_date?: string;
  status: 'active' | 'resolved' | 'chronic';
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
  icd_code?: string;
}

// Immunization record data
export interface ImmunizationRecordData extends BaseRecordData {
  vaccine_name: string;
  administration_date: string;
  lot_number?: string;
  manufacturer?: string;
  site?: string;
  route?: string;
  dose?: string;
  notes?: string;
}

// Surgery record data
export interface SurgeryRecordData extends BaseRecordData {
  procedure_name: string;
  surgery_date: string;
  surgeon?: string;
  hospital?: string;
  notes?: string;
  complications?: string;
}

// Vitals record data
export interface VitalsRecordData extends BaseRecordData {
  recorded_at: string;
  height?: number;
  height_unit?: 'cm' | 'in';
  weight?: number;
  weight_unit?: 'kg' | 'lbs';
  bmi?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  temperature?: number;
  temperature_unit?: 'F' | 'C';
  respiratory_rate?: number;
  oxygen_saturation?: number;
  notes?: string;
}

// Pharmacy record data
export interface PharmacyRecordData extends BaseRecordData {
  pharmacy_name: string;
  address?: string;
  phone?: string;
  fax?: string;
  is_preferred?: boolean;
  notes?: string;
}

// Emergency contact record data
export interface EmergencyContactRecordData extends BaseRecordData {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  is_primary?: boolean;
  notes?: string;
}

// Document record data
export interface DocumentRecordData extends BaseRecordData {
  document_name: string;
  document_type: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
  share_with_practice?: boolean;
  uploaded_by?: string;
}

// Insurance record data
export interface InsuranceRecordData extends BaseRecordData {
  insurance_company: string;
  policy_number: string;
  group_number?: string;
  subscriber_name?: string;
  subscriber_relationship?: string;
  effective_date?: string;
  expiration_date?: string;
  is_primary?: boolean;
  notes?: string;
}

// Discriminated union for all record types
export type VaultRecordData =
  | AllergyRecordData
  | MedicationRecordData
  | ConditionRecordData
  | ImmunizationRecordData
  | SurgeryRecordData
  | VitalsRecordData
  | PharmacyRecordData
  | EmergencyContactRecordData
  | DocumentRecordData
  | InsuranceRecordData;

// Medical vault record with typed data
export interface MedicalVaultRecord {
  id: string;
  patient_account_id: string;
  record_type: 'allergy' | 'medication' | 'condition' | 'immunization' | 'procedure' | 'vital_sign' | 'pharmacy' | 'emergency_contact' | 'document' | 'insurance';
  record_data: VaultRecordData;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  created_by_role?: string;
}

// Audit log entry
export interface MedicalVaultAuditLog {
  id: string;
  patient_account_id: string;
  record_id?: string;
  action_type: string;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
}
