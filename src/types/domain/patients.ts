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

import type { TypedVaultRecord } from "@/types/vault/records";

// Extract specific typed records from the discriminated union
type ExtractVaultRecord<T extends TypedVaultRecord['record_type']> = Extract<TypedVaultRecord, { record_type: T }>;

export interface PatientMedicalData {
  account: any; // Database row type
  medications: Array<ExtractVaultRecord<'medication'>>;
  conditions: Array<ExtractVaultRecord<'condition'>>;
  allergies: Array<ExtractVaultRecord<'allergy'>>;
  vitals: Array<ExtractVaultRecord<'vital_sign'>>;
  immunizations: Array<ExtractVaultRecord<'immunization'>>;
  surgeries: Array<ExtractVaultRecord<'procedure'>>;
  pharmacies: Array<ExtractVaultRecord<'pharmacy'>>;
  emergencyContacts: Array<ExtractVaultRecord<'emergency_contact'>>;
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}
