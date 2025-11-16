// Typed accessor layer for patient_medical_vault records
// Provides safe access to nested record_data fields

export type VaultRecordBase = {
  id: string;
  record_type: string;
  record_data: any;
  patient_account_id: string;
  created_at: string;
  updated_at?: string;
};

export function asMedication(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
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
  };
}

export function asCondition(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    condition_name?: string;
    description?: string;
    date_diagnosed?: string;
    severity?: string;
    treatment_plan?: string;
    associated_provider?: string;
    notes?: string;
    is_active?: boolean;
  };
}

export function asAllergy(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    allergen_name?: string;
    reaction_type?: string;
    severity?: string;
    date_recorded?: string;
    notes?: string;
    nka?: boolean;
    is_active?: boolean;
  };
}

export function asVital(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    date_recorded?: string;
    notes?: string;
  };
}

export function asImmunization(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    vaccine?: string;
    date_administered?: string;
    lot_number?: string;
    administered_by?: string;
    notes?: string;
  };
}

export function asSurgery(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    procedure?: string;
    surgery_type?: string;
    date?: string;
    surgeon?: string;
    facility?: string;
    notes?: string;
  };
}

export function asPharmacy(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    name?: string;
    npi?: string;
    phone?: string;
    fax?: string;
    address?: string;
    is_preferred?: boolean;
    notes?: string;
  };
}

export function asEmergencyContact(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
    address?: string;
    preferred_contact_method?: string;
    is_primary?: boolean;
  };
}

export function asDocument(r: VaultRecordBase) {
  return (r?.record_data ?? {}) as {
    title?: string;
    url?: string;
    file_type?: string;
    file_size?: number;
    share_with_practice?: boolean;
    category?: string;
    notes?: string;
  };
}
