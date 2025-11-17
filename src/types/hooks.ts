/**
 * Hook Types
 * 
 * Shared type definitions for custom hooks.
 * Provides proper typing for hook parameters and return values.
 */

import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// ============= Pagination =============

export interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
}

// ============= Search & Filters =============

export interface SearchOptions {
  query: string;
  fields?: string[];
  caseSensitive?: boolean;
}

export interface AppointmentSearchOptions extends SearchOptions {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  providerId?: string;
}

// ============= Dashboard Queries =============

export interface DashboardQueryOptions<TData = unknown> {
  enabled?: boolean;
  staleTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
}

// ============= Cart Management =============

export interface UseCartOptions {
  userId?: string;
  enabled?: boolean;
  productFields?: string;
  includePharmacy?: boolean;
  includeProvider?: boolean;
  hydratePatients?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
}

// ============= Notification Settings =============

export interface NotificationChannel {
  email: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface NotificationSettings {
  [eventType: string]: NotificationChannel;
}

export interface UseNotificationSettingsResult {
  settings: NotificationSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (settings: NotificationSettings) => Promise<void>;
}

// ============= Patient Management =============

export interface PatientNote {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
  patient_account_id: string;
  shared_with_patient: boolean;
}

export interface CreatePatientNoteParams {
  patientAccountId: string;
  note: string;
  sharedWithPatient: boolean;
}

// ============= Treatment Plans =============

export interface TreatmentPlanGoal {
  id: string;
  plan_id: string;
  goal: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface TreatmentPlanUpdate {
  id: string;
  plan_id: string;
  update: string;
  created_at: string;
  created_by: string;
}

export interface TreatmentPlan {
  id: string;
  patient_account_id: string;
  diagnosis: string;
  treatment_summary: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'discontinued';
  locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  created_by: string;
  goals?: TreatmentPlanGoal[];
  updates?: TreatmentPlanUpdate[];
}

// ============= Medical Data =============

export interface PatientMedicalRecord {
  id: string;
  patient_account_id: string;
  record_type: string;
  record_data: any;
  recorded_at: string;
  recorded_by: string;
}

// ============= Debounce =============

export type DebouncedValue<T> = T;

// ============= Error Dialog =============

export interface UseErrorDialogResult {
  showError: (title: string, message: string) => void;
  ErrorDialog: React.ComponentType;
}

// ============= Metrics & Analytics =============

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeriesOptions {
  metricName: string;
  startDate: Date;
  endDate: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface UseMetricTimeSeriesResult {
  data: TimeSeriesDataPoint[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

// ============= Message Alerts =============

export interface MessageAlert {
  id: string;
  type: 'unread_message' | 'unread_internal_chat';
  count: number;
  message: string;
}

export interface UseMessageAlertsResult {
  alerts: MessageAlert[];
  totalUnread: number;
  hasAlerts: boolean;
}
