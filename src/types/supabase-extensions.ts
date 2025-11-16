/**
 * Type definitions for Supabase tables not yet in generated types
 * These should be removed once the types are regenerated from the database
 */

export interface PatientNote {
  id: string;
  patient_account_id: string;
  note_content: string;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  last_edited_by_user_id?: string;
  last_edited_by_name?: string;
  last_edited_at?: string;
  share_with_patient: boolean;
  is_active: boolean;
}

export interface MedicalVaultShareLink {
  id: string;
  patient_account_id: string;
  share_token: string;
  created_by_user_id: string;
  expires_at: string;
  access_count: number;
  max_access_count: number | null;
  is_active: boolean;
  created_at: string;
}

export interface MedicalVaultAuditLog {
  id: string;
  patient_account_id: string;
  action_type: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  entity_type: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form' | 'document';
  entity_id?: string;
  entity_name?: string;
  changed_by_user_id?: string;
  changed_by_role?: 'patient' | 'doctor' | 'staff' | 'provider';
  old_data?: any;
  new_data?: any;
  change_summary?: string;
  created_at: string;
}

export interface PharmacyShippingRate {
  id: string;
  pharmacy_id: string;
  shipping_speed: string;
  rate: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PracticeAutomationSettings {
  id: string;
  practice_id: string;
  enable_email_notifications: boolean;
  enable_sms_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageThreadReadStatus {
  id: string;
  user_id: string;
  thread_id: string;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export interface PatientFollowUp {
  id: string;
  patient_account_id: string;
  follow_up_date: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Type-safe client extensions
export interface SupabaseClientExtended {
  from(table: 'patient_notes'): any;
  from(table: 'medical_vault_share_links'): any;
  from(table: 'medical_vault_audit_logs'): any;
  from(table: 'pharmacy_shipping_rates'): any;
  from(table: 'practice_automation_settings'): any;
  from(table: 'message_thread_read_status'): any;
  from(table: 'patient_follow_ups'): any;
}
