/**
 * Patient Domain Types
 * Centralized type definitions for patient-related data structures
 */

// Re-export vault types for convenience
export type {
  MedicationRecordData,
  ConditionRecordData,
  AllergyRecordData,
  VitalRecordData,
  ImmunizationRecordData,
  SurgeryRecordData,
  PharmacyRecordData,
  EmergencyContactRecordData,
  TypedVaultRecord,
} from "@/types/vault/records";

// Flexible vault record type for runtime data (uses any for JSONB boundary as documented in vault.ts)
interface VaultRecordBase {
  id: string;
  patient_account_id: string;
  record_type: string;
  record_data: any; // JSONB boundary - keep as any for runtime flexibility
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
  [key: string]: any;
}

export interface PatientMedicalData {
  account: any;
  medications: VaultRecordBase[];
  conditions: VaultRecordBase[];
  allergies: VaultRecordBase[];
  vitals: VaultRecordBase[];
  immunizations: VaultRecordBase[];
  surgeries: VaultRecordBase[];
  pharmacies: VaultRecordBase[];
  emergencyContacts: VaultRecordBase[];
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}
