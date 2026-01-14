/**
 * Hooks Domain Types
 * Centralized type definitions for custom hook return values and parameters
 */

import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';

// ============= Query Key Types =============

export type QueryKey = readonly unknown[];

export interface DashboardQueryKey extends Array<unknown> {
  0: string; // Query identifier
  1?: string | null; // User ID or other identifier
  2?: Record<string, unknown>; // Optional filters/params
}

// ============= Appointment Search =============

export interface Appointment {
  id: string;
  patient_account_id: string;
  provider_id: string;
  appointment_datetime?: string; // Legacy field
  start_time: string; // Current field used in patient_appointments table
  duration_minutes?: number;
  status: string;
  service_type_id?: string;
  notes?: string;
  patient_name?: string;
  provider_name?: string;
  patient_accounts?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

export interface AppointmentSearchFilters {
  dateRange?: { start: Date; end: Date };
  providerIds?: string[];
  statusList?: string[];
  maxResults?: number;
}

// ============= Dashboard Stats =============

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id?: string;
  user_name?: string;
  details?: Record<string, unknown>;
}

export interface PharmacyActivityEntry {
  id: string;
  order_id: string;
  order_number?: string;
  action: string;
  timestamp: string;
  status?: string;
  patient_name?: string;
}

export interface DashboardStats {
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  recentActivity: ActivityLogEntry[];
  [key: string]: unknown;
}

// ============= Realtime Channel =============

export interface RealtimeChannel {
  subscribe: () => void;
  unsubscribe: () => void;
  on: (event: string, callback: (payload: unknown) => void) => RealtimeChannel;
}

export interface RealtimeSubscriptionConfig {
  event: string;
  schema: string;
  table?: string;
  filter?: string;
}
