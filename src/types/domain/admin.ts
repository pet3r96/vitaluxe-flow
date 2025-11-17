/**
 * Admin Domain Types
 * Centralized type definitions for admin, impersonation, and audit systems
 */

import type { Database } from "@/integrations/supabase/types";

// ============= Impersonation =============

export interface ImpersonationSession {
  id: string;
  admin_user_id: string;
  impersonated_user_id: string | null;
  impersonated_user_name: string | null;
  impersonated_role: string;
  impersonation_log_id: string | null;
  expires_at: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface ImpersonationLog {
  id: string;
  impersonator_id: string;
  impersonator_email: string;
  target_user_id: string | null;
  target_user_email: string;
  target_user_name: string;
  target_role: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
}

export interface ImpersonationSessionData {
  role: string;
  userId: string | null;
  userName: string | null;
  targetEmail: string | null;
  logId?: string;
}

/**
 * Raw impersonation session data from edge function response
 * (matches database column names from active_impersonation_sessions)
 */
export interface ImpersonationSessionResponse {
  impersonated_role: string;
  impersonated_user_id: string | null;
  impersonated_user_name: string | null;
  impersonation_log_id: string | null;
  expires_at?: string;
  last_activity?: string;
}

// ============= Audit Logs =============

export type AuditActionType = 
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'role_change'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'data_export'
  | 'settings_change';

export type AuditEntityType =
  | 'user'
  | 'order'
  | 'patient'
  | 'product'
  | 'appointment'
  | 'message'
  | 'payment'
  | 'refund';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action_type: AuditActionType | string;
  entity_type: AuditEntityType | string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ============= IP Ban Management =============

export interface IPBanEntry {
  id: string;
  ip_address: string;
  banned: boolean;
  banned_by: string;
  banned_reason: string;
  banned_at: string;
  expires_at: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIPBanRequest {
  ip_address: string;
  banned_reason: string;
  description?: string;
  expires_at?: string;
}

// ============= Factory Reset =============

export interface FactoryResetDryRun {
  users_to_delete: number;
  orders_to_delete: number;
  patients_to_delete: number;
  products_to_delete: number;
  admin_verified: boolean;
  admin_email: string;
  admin_user_id: string;
}

export interface FactoryResetResult {
  success: boolean;
  users_deleted: number;
  orders_deleted: number;
  patients_deleted: number;
  products_deleted: number;
  logs_purged: boolean;
  admin_preserved: {
    id: string;
    email: string;
  };
  timestamp: string;
}

// ============= System Configuration =============

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface RoleConfiguration {
  role: AppRole;
  display_name: string;
  permissions: string[];
  hierarchy_level: number;
}

export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============= Account Management =============

export interface AccountDetails {
  id: string;
  email: string;
  role: AppRole;
  name?: string;
  phone?: string;
  must_change_password: boolean;
  terms_accepted: boolean;
  two_factor_enabled: boolean;
  two_factor_phone?: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
}

export interface AccountAction {
  type: 'reset_password' | 'reset_2fa' | 'resend_email' | 'change_role' | 'delete_account';
  target_user_id: string;
  target_email: string;
  performed_by: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============= Representative Requests =============

export interface RepresentativeRequest {
  id: string;
  requesting_rep_id: string;
  requested_for: 'self' | 'downline';
  requested_name: string;
  requested_email: string;
  requested_phone?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  created_at: string;
  updated_at: string;
}
