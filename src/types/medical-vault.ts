/**
 * Medical Vault Type Definitions
 * Comprehensive types for patient medical records
 */

export interface MedicalVaultRecord {
  id: string;
  patient_account_id: string;
  record_type: 'medication' | 'allergy' | 'condition' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'document';
  record_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PatientChartData {
  account: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    birth_date?: string;
    date_of_birth?: string;
    gender_at_birth?: string;
    address?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
  };
  medications: MedicalVaultRecord[];
  conditions: MedicalVaultRecord[];
  allergies: MedicalVaultRecord[];
  vitals: MedicalVaultRecord[];
  immunizations: MedicalVaultRecord[];
  surgeries: MedicalVaultRecord[];
  pharmacies: MedicalVaultRecord[];
  emergencyContacts: MedicalVaultRecord[];
}

export interface PatientMedicalData {
  patient: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
  };
  vitals: MedicalVaultRecord[];
  medications: MedicalVaultRecord[];
  allergies: MedicalVaultRecord[];
  conditions: MedicalVaultRecord[];
  surgeries: MedicalVaultRecord[];
  immunizations: MedicalVaultRecord[];
  pharmacies: MedicalVaultRecord[];
  documents: MedicalVaultRecord[];
  notes: any[];
}
