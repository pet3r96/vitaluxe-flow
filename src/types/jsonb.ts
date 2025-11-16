/**
 * JSONB Field Type Safety
 * 
 * Safe accessors and parsers for JSONB columns in the database.
 * Use these instead of (as any) casts when accessing JSONB fields.
 */

import type { Json } from "@/integrations/supabase/types";

// ============= Safe JSONB Parsing =============

/**
 * Safely parse a JSONB value with type checking
 */
export function parseJsonb<T = Record<string, unknown>>(value: Json | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  
  // If it's already an object, return it
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Safely get a nested property from a JSONB object
 */
export function getJsonbProperty<T = unknown>(
  jsonb: Json | null | undefined,
  path: string[]
): T | null {
  if (!jsonb || typeof jsonb !== 'object') return null;
  
  let current: any = jsonb;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return null;
    }
  }
  
  return current as T;
}

/**
 * Check if a JSONB value is a valid object
 */
export function isJsonbObject(value: Json | null | undefined): value is Record<string, Json> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a JSONB value is a valid array
 */
export function isJsonbArray(value: Json | null | undefined): value is Json[] {
  return Array.isArray(value);
}

// ============= Message Metadata Types =============

export interface MessageMetadata {
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
  thread_id?: string;
  replied_to?: string;
  edited_at?: string;
  [key: string]: unknown;
}

export function parseMessageMetadata(metadata: Json | null | undefined): MessageMetadata {
  const parsed = parseJsonb<MessageMetadata>(metadata);
  return parsed || {};
}

// ============= Notification Metadata Types =============

export interface NotificationMetadata {
  order_id?: string;
  patient_id?: string;
  practice_id?: string;
  message_id?: string;
  appointment_id?: string;
  document_id?: string;
  action_type?: string;
  [key: string]: unknown;
}

export function parseNotificationMetadata(metadata: Json | null | undefined): NotificationMetadata {
  const parsed = parseJsonb<NotificationMetadata>(metadata);
  return parsed || {};
}

// ============= Order Metadata Types =============

export interface PharmacyOrderMetadata {
  pharmacy_id?: string;
  pharmacy_name?: string;
  order_id?: string;
  external_order_id?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  notes?: string;
  [key: string]: unknown;
}

export function parsePharmacyOrderMetadata(metadata: Json | null | undefined): PharmacyOrderMetadata {
  const parsed = parseJsonb<PharmacyOrderMetadata>(metadata);
  return parsed || {};
}

// ============= Audit Log Details Types =============

export interface AuditLogDetails {
  action?: string;
  entity_type?: string;
  entity_id?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ip_address?: string;
  user_agent?: string;
  error?: string;
  success?: boolean;
  [key: string]: unknown;
}

export function parseAuditLogDetails(details: Json | null | undefined): AuditLogDetails {
  const parsed = parseJsonb<AuditLogDetails>(details);
  return parsed || {};
}

// ============= Order Status History Metadata Types =============

export interface OrderStatusMetadata {
  reason?: string;
  notes?: string;
  changed_by_name?: string;
  changed_by_role?: string;
  tracking_number?: string;
  carrier?: string;
  [key: string]: unknown;
}

export function parseOrderStatusMetadata(metadata: Json | null | undefined): OrderStatusMetadata {
  const parsed = parseJsonb<OrderStatusMetadata>(metadata);
  return parsed || {};
}

// ============= Notification Template Variables =============

export interface NotificationTemplateVariables {
  variables: Array<{
    name: string;
    description: string;
    example?: string;
  }>;
}

export function parseNotificationTemplateVariables(variables: Json | null | undefined): NotificationTemplateVariables {
  const parsed = parseJsonb<NotificationTemplateVariables>(variables);
  return parsed || { variables: [] };
}

// ============= Practice Staff Permissions =============

export interface StaffPermissions {
  can_view_orders?: boolean;
  can_create_orders?: boolean;
  can_edit_orders?: boolean;
  can_cancel_orders?: boolean;
  can_view_patients?: boolean;
  can_edit_patients?: boolean;
  can_view_documents?: boolean;
  can_upload_documents?: boolean;
  can_view_reports?: boolean;
  [key: string]: unknown;
}

export function parseStaffPermissions(permissions: Json | null | undefined): StaffPermissions {
  const parsed = parseJsonb<StaffPermissions>(permissions);
  return parsed || {};
}

// ============= Notification Preferences Channels =============

export interface NotificationChannels {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  in_app?: boolean;
  [key: string]: boolean | undefined;
}

export function parseNotificationChannels(channels: Json | null | undefined): NotificationChannels {
  const parsed = parseJsonb<NotificationChannels>(channels);
  return parsed || { email: true, sms: true, push: true, in_app: true };
}

// ============= Generic JSONB Array Parsing =============

export function parseJsonbArray<T = unknown>(value: Json | null | undefined): T[] {
  if (isJsonbArray(value)) {
    return value as T[];
  }
  return [];
}

// ============= Generic JSONB Object Parsing =============

export function parseJsonbObject<T = Record<string, unknown>>(value: Json | null | undefined): T {
  const parsed = parseJsonb<T>(value);
  return parsed || {} as T;
}

// ============= Edge Function Response Types =============

export interface EdgeFunctionErrorResponse {
  error?: string;
  details?: string | Record<string, unknown>;
  message?: string;
  code?: string;
  [key: string]: unknown;
}

export function parseEdgeFunctionError(response: unknown): EdgeFunctionErrorResponse {
  if (typeof response === 'object' && response !== null) {
    return response as EdgeFunctionErrorResponse;
  }
  return {};
}

// ============= Checkout Attestation Data =============

export interface CheckoutAttestationData {
  title: string;
  subtitle?: string;
  content: string;
  checkbox_text: string;
  version?: number;
  [key: string]: unknown;
}

export function parseCheckoutAttestation(data: unknown): CheckoutAttestationData | null {
  if (typeof data === 'object' && data !== null) {
    const attestation = data as Record<string, unknown>;
    if (typeof attestation.title === 'string' && typeof attestation.content === 'string') {
      return {
        title: attestation.title,
        subtitle: typeof attestation.subtitle === 'string' ? attestation.subtitle : undefined,
        content: attestation.content,
        checkbox_text: typeof attestation.checkbox_text === 'string' ? attestation.checkbox_text : '',
        version: typeof attestation.version === 'number' ? attestation.version : undefined,
        ...attestation
      };
    }
  }
  return null;
}

// ============= Error Log Details =============

export interface ErrorLogDetails {
  error_message?: string;
  message?: string;
  stack?: string;
  code?: string;
  user_id?: string;
  [key: string]: unknown;
}

export function parseErrorLogDetails(details: Json | null | undefined): ErrorLogDetails {
  const parsed = parseJsonb<ErrorLogDetails>(details);
  return parsed || {};
}
