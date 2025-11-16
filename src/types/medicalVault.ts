/**
 * Medical Vault Type Definitions
 * 
 * Centralized type exports for medical vault records, JSONB handling,
 * and PDF generation. All medical vault components should import from here.
 */

// Re-export all vault record types
export type {
  MedicationRecordData,
  ConditionRecordData,
  AllergyRecordData,
  VitalRecordData,
  ImmunizationRecordData,
  SurgeryRecordData,
  PharmacyRecordData,
  EmergencyContactRecordData,
  DocumentRecordData,
  NoteRecordData,
  TypedVaultRecord,
} from "@/types/vault/records";

// Re-export JSONB helpers
export { toJsonSafe, fromJsonSafe } from "@/types/vault/jsonHelpers";

// Re-export vault accessor functions
export {
  type VaultRecordBase,
  asMedication,
  asCondition,
  asAllergy,
  asVital,
  asImmunization,
  asSurgery,
  asPharmacy,
  asEmergencyContact,
  asDocument,
  flattenForPdf,
} from "@/lib/vault";

// Record type discriminator
export type VaultRecordType = 
  | 'medication'
  | 'condition'
  | 'allergy'
  | 'vital'
  | 'immunization'
  | 'surgery'
  | 'pharmacy'
  | 'emergency_contact'
  | 'document'
  | 'note';

// Map of record types to their data interfaces
export interface RecordDataMap {
  medication: import("@/types/vault/records").MedicationRecordData;
  condition: import("@/types/vault/records").ConditionRecordData;
  allergy: import("@/types/vault/records").AllergyRecordData;
  vital: import("@/types/vault/records").VitalRecordData;
  immunization: import("@/types/vault/records").ImmunizationRecordData;
  surgery: import("@/types/vault/records").SurgeryRecordData;
  pharmacy: import("@/types/vault/records").PharmacyRecordData;
  emergency_contact: import("@/types/vault/records").EmergencyContactRecordData;
  document: import("@/types/vault/records").DocumentRecordData;
  note: import("@/types/vault/records").NoteRecordData;
}

// Helper type to get record data type from record type string
export type RecordDataFromType<T extends VaultRecordType> = RecordDataMap[T];

// Vault section query result type
export interface VaultSectionData<T extends VaultRecordType> {
  records: Array<{
    id: string;
    patient_account_id: string;
    record_type: T;
    record_data: RecordDataFromType<T>;
    created_at: string;
    updated_at?: string;
  }>;
  isLoading: boolean;
  error: Error | null;
}

// Medical vault summary for PDF generation
export interface MedicalVaultSummary {
  patient: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    gender?: string | null;
    phone_number?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };
  medications: Array<import("@/types/vault/records").MedicationRecordData & { id: string; created_at: string }>;
  conditions: Array<import("@/types/vault/records").ConditionRecordData & { id: string; created_at: string }>;
  allergies: Array<import("@/types/vault/records").AllergyRecordData & { id: string; created_at: string }>;
  vitals: Array<import("@/types/vault/records").VitalRecordData & { id: string; created_at: string }>;
  immunizations: Array<import("@/types/vault/records").ImmunizationRecordData & { id: string; created_at: string }>;
  surgeries: Array<import("@/types/vault/records").SurgeryRecordData & { id: string; created_at: string }>;
  pharmacies: Array<import("@/types/vault/records").PharmacyRecordData & { id: string; created_at: string }>;
  emergencyContacts: Array<import("@/types/vault/records").EmergencyContactRecordData & { id: string; created_at: string }>;
}

// Vault dialog modes
export type VaultDialogMode = "add" | "edit" | "view";

// Vault section props pattern
export interface VaultSectionProps<T extends VaultRecordType = VaultRecordType> {
  patientAccountId?: string;
  canEdit?: boolean;
  mode?: "patient" | "practice";
}

// Share link data
export interface ShareLinkData {
  shareUrl: string;
  expiresAt: Date;
  token: string;
}

// Audit log entry for vault changes
export interface VaultAuditEntry {
  id: string;
  patient_account_id: string;
  record_id: string | null;
  action_type: string;
  change_summary: string | null;
  changed_by: string | null;
  created_at: string;
  changer?: {
    email?: string;
    full_name?: string;
    role?: string;
  };
}
