import type { Database } from "@/integrations/supabase/types";

// Base vault record from Supabase
type VaultRow = Database['public']['Tables']['patient_medical_vault']['Row'];
type VaultInsert = Database['public']['Tables']['patient_medical_vault']['Insert'];
type VaultUpdate = Database['public']['Tables']['patient_medical_vault']['Update'];

// Specific record_data types
export interface MedicationRecordData {
  medication_name: string;
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
  condition_name: string;
  description?: string;
  date_diagnosed?: string;
  severity?: string;
  treatment_plan?: string;
  associated_provider?: string;
  notes?: string;
  is_active?: boolean;
}

export interface AllergyRecordData {
  allergen_name: string;
  reaction_type?: string;
  severity?: string;
  date_recorded?: string;
  notes?: string;
  nka?: boolean;
  is_active?: boolean;
}

export interface VitalRecordData {
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

export interface ImmunizationRecordData {
  vaccine: string;
  vaccine_name?: string;
  date_administered: string;
  lot_number?: string;
  administered_by?: string;
  notes?: string;
}

export interface SurgeryRecordData {
  procedure: string;
  surgery_type?: string;
  surgery_date?: string;
  date?: string;
  surgeon?: string;
  facility?: string;
  notes?: string;
}

export interface PharmacyRecordData {
  name: string;
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
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  preferred_contact_method?: string;
  is_primary?: boolean;
}

export interface DocumentRecordData {
  title: string;
  url: string;
  file_type?: string;
  file_size?: number;
  share_with_practice?: boolean;
  category?: string;
  notes?: string;
  storage_path?: string;
  document_type?: string;
  document_name?: string;
  uploaded_by?: string;
  uploaded_at?: string;
}

export interface NoteRecordData {
  note_content: string;
  note_type?: string;
  created_by_user_id: string;
  created_by_name: string;
  created_by_role: string;
  created_at?: string;
}

// Discriminated union based on record_type
export type TypedVaultRecord =
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'medication'; record_data: MedicationRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'condition'; record_data: ConditionRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'allergy'; record_data: AllergyRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'vital'; record_data: VitalRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'immunization'; record_data: ImmunizationRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'surgery'; record_data: SurgeryRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'pharmacy'; record_data: PharmacyRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'emergency_contact'; record_data: EmergencyContactRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'document'; record_data: DocumentRecordData })
  | (Omit<VaultRow, 'record_data' | 'record_type'> & { record_type: 'note'; record_data: NoteRecordData });

// Type guards for runtime checking
// Note: These use type assertions since VaultRow.record_data is Json type
export function isMedicationRecord(record: any): record is TypedVaultRecord & { record_type: 'medication' } {
  return record.record_type === 'medication';
}

export function isConditionRecord(record: any): record is TypedVaultRecord & { record_type: 'condition' } {
  return record.record_type === 'condition';
}

export function isAllergyRecord(record: any): record is TypedVaultRecord & { record_type: 'allergy' } {
  return record.record_type === 'allergy';
}

export function isVitalRecord(record: any): record is TypedVaultRecord & { record_type: 'vital' } {
  return record.record_type === 'vital';
}

export function isImmunizationRecord(record: any): record is TypedVaultRecord & { record_type: 'immunization' } {
  return record.record_type === 'immunization';
}

export function isSurgeryRecord(record: any): record is TypedVaultRecord & { record_type: 'surgery' } {
  return record.record_type === 'surgery';
}

export function isPharmacyRecord(record: any): record is TypedVaultRecord & { record_type: 'pharmacy' } {
  return record.record_type === 'pharmacy';
}

export function isEmergencyContactRecord(record: any): record is TypedVaultRecord & { record_type: 'emergency_contact' } {
  return record.record_type === 'emergency_contact';
}

export function isDocumentRecord(record: any): record is TypedVaultRecord & { record_type: 'document' } {
  return record.record_type === 'document';
}

export function isNoteRecord(record: any): record is TypedVaultRecord & { record_type: 'note' } {
  return record.record_type === 'note';
}
