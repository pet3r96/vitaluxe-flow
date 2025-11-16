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

export interface PatientMedicalData {
  account: any;
  medications: any[];
  conditions: any[];
  allergies: any[];
  vitals: any[];
  immunizations: any[];
  surgeries: any[];
  pharmacies: any[];
  emergencyContacts: any[];
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}

export interface PatientQueryParams {
  effectiveRole: string;
  effectivePracticeId: string | null;
}
