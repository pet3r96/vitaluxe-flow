/**
 * Manual Schema Types
 * Type definitions for tables not included in generated Supabase types
 * or for tables that need custom typing
 */

import type { Database } from '@/integrations/supabase/types';

// ==================== MISSING DATABASE TABLES ====================
// These tables exist in the database but are not in generated Supabase types

// Provider documents table (accessed via RPC, not direct table)
export interface ProviderDocument {
  id: string;
  practice_id: string;
  document_name: string;
  document_type: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
  uploaded_at: string;
  uploaded_by?: string;
  is_active?: boolean;
}

// Internal message replies table
export interface InternalMessageReply {
  id: string;
  message_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface InternalMessageReplyInsert {
  message_id: string;
  sender_id: string;
  body: string;
}

// Rep product visibility table
export interface RepProductVisibility {
  id: string;
  topline_rep_id: string;
  product_id: string;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepProductVisibilityRow {
  product_id: string;
  visible: boolean;
}

export interface RepProductVisibilityUpsert {
  topline_rep_id: string;
  product_id: string;
  visible: boolean;
  updated_at: string;
}

// Patient portal terms table
export interface PatientPortalTerms {
  id: string;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface PatientPortalTermsInsert {
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface PatientPortalTermsUpdate {
  title?: string;
  content?: string;
  version?: number;
  updated_at?: string;
  updated_by?: string;
}

// Checkout attestation table
export interface CheckoutAttestation {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  checkbox_text: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface CheckoutAttestationUpdate {
  title?: string;
  subtitle?: string;
  content?: string;
  checkbox_text?: string;
  version?: number;
  updated_at?: string;
  updated_by?: string;
}

// Subscription upgrade prompts table
export interface SubscriptionUpgradePrompt {
  id: string;
  practice_id: string;
  last_shown_at: string | null;
  show_count: number;
  permanently_dismissed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUpgradePromptInsert {
  practice_id: string;
  last_shown_at?: string;
  show_count?: number;
  permanently_dismissed?: boolean;
}

export interface SubscriptionUpgradePromptUpdate {
  last_shown_at?: string;
  show_count?: number;
  permanently_dismissed?: boolean;
}

// Pharmacy rep assignments table
export interface PharmacyRepAssignment {
  id: string;
  pharmacy_id: string;
  topline_rep_id: string;
  created_at: string;
  updated_at: string;
}

export interface PharmacyRepAssignmentInsert {
  pharmacy_id: string;
  topline_rep_id: string;
}

export interface PharmacyRepAssignmentRow {
  topline_rep_id: string;
}

// ==================== EXISTING TYPES ====================

// Rep product price overrides table
export interface RepProductPriceOverride {
  id: string;
  rep_id: string;
  product_id: string;
  override_topline_price?: number;
  override_downline_price?: number;
  override_retail_price?: number;
  created_at: string;
  updated_at: string;
}

// Invoice template data (JSONB field)
export interface InvoiceTemplateData {
  line_items: InvoiceLineItem[];
  notes?: string;
  subtotal: number;
  total_due: number;
  tax_amount?: number;
  discount_amount?: number;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// Practice development fee invoice (extended)
export interface PracticeDevelopmentFeeInvoice {
  id: string;
  practice_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
  invoice_template_data: InvoiceTemplateData;
  created_at: string;
  updated_at: string;
}

// SMS verification code with profile relation
export interface SmsVerificationCodeWithProfile {
  id: string;
  user_id: string;
  phone: string;
  code: string;
  expires_at: string;
  verified: boolean;
  attempt_count: number;
  created_at: string;
  verified_at: string;
  profiles?: {
    id: string;
    name?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
}

// Activity log entry (generic structure)
export interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Pending rep request
export interface PendingRepRequest {
  id: string;
  created_by_user_id: string;
  created_by_role: Database["public"]["Enums"]["app_role"];
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  role: 'topline_rep' | 'downline_rep';
  assigned_topline_user_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

// Pending practice request
export interface PendingPracticeRequest {
  id: string;
  practice_id: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  created_at: string;
  requested_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

// Product rep assignment
export interface ProductRepAssignment {
  id: string;
  product_id: string;
  rep_id: string;
  created_at: string;
}

// Patient activity log
export interface PatientActivityLog {
  id: string;
  patient_account_id: string;
  action: string;
  created_at: string;
  details?: unknown;
  action_by?: string;
  action_by_role?: string;
}

// Active session
export interface ActiveSession {
  id: string;
  user_id: string;
  started_at: string;
  last_seen_at?: string | null;
  context?: unknown;
  session_type?: string;
}

// Shared document (extended from medical vault)
export interface SharedDocument {
  id: string;
  patient_account_id: string;
  record_type: 'document';
  record_data: {
    document_name: string;
    document_type: string;
    file_url: string;
    share_with_practice?: boolean;
    [key: string]: any;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// RPC function return types
export interface OrdersByStatusRow {
  status: string;
  count: number;
}

// Rep product price overrides table (in public schema, not always in generated types)
export interface RepProductPriceOverrideRow {
  id: string;
  rep_id: string;
  product_id: string;
  override_topline_price: number | null;
  override_downline_price: number | null;
  override_retail_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface RepProductPriceOverrideInsert {
  rep_id: string;
  product_id: string;
  override_topline_price?: number | null;
  override_downline_price?: number | null;
  override_retail_price?: number | null;
}

// Type guard helpers
export function isProviderDocument(doc: any): doc is ProviderDocument {
  return doc && typeof doc.practice_id === 'string' && typeof doc.document_name === 'string';
}

export function isRepProductPriceOverride(override: any): override is RepProductPriceOverride {
  return override && typeof override.rep_id === 'string' && typeof override.product_id === 'string';
}

// Supabase client extension for custom tables
export interface SupabaseClientExtensions {
  provider_documents: {
    Row: ProviderDocument;
    Insert: Omit<ProviderDocument, 'id' | 'uploaded_at'>;
    Update: Partial<Omit<ProviderDocument, 'id' | 'uploaded_at'>>;
  };
  internal_message_replies: {
    Row: InternalMessageReply;
    Insert: InternalMessageReplyInsert;
    Update: Partial<Omit<InternalMessageReply, 'id' | 'created_at'>>;
  };
  rep_product_visibility: {
    Row: RepProductVisibility;
    Insert: Omit<RepProductVisibility, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<Omit<RepProductVisibility, 'id' | 'created_at'>>;
  };
  patient_portal_terms: {
    Row: PatientPortalTerms;
    Insert: PatientPortalTermsInsert;
    Update: PatientPortalTermsUpdate;
  };
  checkout_attestation: {
    Row: CheckoutAttestation;
    Insert: Omit<CheckoutAttestation, 'id' | 'created_at' | 'updated_at'>;
    Update: CheckoutAttestationUpdate;
  };
  subscription_upgrade_prompts: {
    Row: SubscriptionUpgradePrompt;
    Insert: SubscriptionUpgradePromptInsert;
    Update: SubscriptionUpgradePromptUpdate;
  };
  pharmacy_rep_assignments: {
    Row: PharmacyRepAssignment;
    Insert: PharmacyRepAssignmentInsert;
    Update: Partial<Omit<PharmacyRepAssignment, 'id' | 'created_at'>>;
  };
}
