/**
 * Forms Domain Types
 * Centralized type definitions for form-related data structures
 */

import type { UseFormReturn, FieldValues } from 'react-hook-form';

// ============= Form State =============

export interface FormFieldError {
  type: string;
  message: string;
}

export interface FormSubmissionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============= Common Form Props =============

export interface BaseFormProps<TFieldValues extends FieldValues = FieldValues> {
  onSubmit: (data: TFieldValues) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<TFieldValues>;
}

export interface DialogFormProps<TFieldValues extends FieldValues = FieldValues> 
  extends BaseFormProps<TFieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
}

// ============= Appointment Forms =============

export interface AppointmentFormData {
  patient_account_id: string;
  provider_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  service_type_id?: string;
  status: string;
  notes?: string;
  follow_up_for?: string;
}

export interface FollowUpFormData {
  patient_account_id: string;
  provider_id: string;
  appointment_datetime: string;
  duration_minutes: number;
  follow_up_for: string;
  notes?: string;
}

// ============= Practice Forms =============

export interface PracticeEditFormData {
  name: string;
  npi?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface PharmacyProfileFormData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  license_number?: string;
  dea_number?: string;
}
