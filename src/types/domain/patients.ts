/**
 * Patient Domain Types
 * Centralized type definitions for patient-related data structures
 */

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
