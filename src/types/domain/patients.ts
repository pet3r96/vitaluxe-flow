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

// Flexible vault record type for runtime data (database returns string, not literal types)
interface VaultRecordBase {
  id: string;
  patient_account_id: string;
  record_type: string;
  record_data: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface PatientMedicalData {
  account: any; // Database row type
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
