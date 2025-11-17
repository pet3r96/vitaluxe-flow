/**
 * Video/Telehealth Domain Types
 * Centralized type definitions for video conferencing and telehealth
 */

import type { IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";

export interface AgoraUserPublished {
  user: IAgoraRTCRemoteUser;
  mediaType: "audio" | "video";
}

export interface AgoraNetworkQuality {
  uplinkNetworkQuality: number;
  downlinkNetworkQuality: number;
}

export interface MedicalChartData {
  patient_account_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  birth_date?: string;
  gender?: string;
  allergies?: MedicalAllergy[];
  conditions?: MedicalCondition[];
  medications?: MedicalMedication[];
  vitals?: MedicalVital[];
  surgeries?: MedicalSurgery[];
  immunizations?: MedicalImmunization[];
  documents?: MedicalDocument[];
  notes?: MedicalNote[];
}

export interface MedicalAllergy {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: string;
  recorded_at?: string;
}

export interface MedicalCondition {
  id: string;
  condition_name: string;
  diagnosed_date?: string;
  status?: string;
  notes?: string;
}

export interface MedicalMedication {
  id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  start_date?: string;
  end_date?: string;
  prescriber?: string;
  status?: string;
}

export interface MedicalVital {
  id: string;
  vital_type: string;
  value: string;
  unit?: string;
  recorded_at: string;
  recorded_by?: string;
}

export interface MedicalSurgery {
  id: string;
  procedure_name: string;
  surgery_date: string;
  surgeon?: string;
  hospital?: string;
  notes?: string;
}

export interface MedicalImmunization {
  id: string;
  vaccine_name: string;
  administration_date: string;
  dose_number?: number;
  administered_by?: string;
  lot_number?: string;
}

export interface MedicalDocument {
  id: string;
  document_name: string;
  document_type?: string;
  uploaded_at: string;
  file_url?: string;
  file_size?: number;
}

export interface MedicalNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  note_type?: string;
  shared_with_patient: boolean;
}

export interface VideoSessionPatient {
  id: string;
  patient_id: string;
  patient_name: string;
  status: string;
  joined_at?: string;
  appointment_time?: string;
  reason_for_visit?: string;
}

export interface VideoSessionProvider {
  id: string;
  provider_id: string;
  provider_name: string;
  specialty?: string;
  status: string;
  availability?: string;
}

export interface VideoDiagnosticsDetails {
  code?: string;
  message?: string;
  stack?: string;
  context?: Record<string, unknown>;
}
