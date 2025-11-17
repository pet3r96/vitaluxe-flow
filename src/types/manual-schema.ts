/**
 * Manual Schema Types
 * Type definitions for tables not included in generated Supabase types
 * or for tables that need custom typing
 */

import type { Database } from '@/integrations/supabase/types';

// Provider documents table (not in generated types)
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

// Type guard helpers
export function isProviderDocument(doc: any): doc is ProviderDocument {
  return doc && typeof doc.practice_id === 'string' && typeof doc.document_name === 'string';
}

export function isRepProductPriceOverride(override: any): override is RepProductPriceOverride {
  return override && typeof override.rep_id === 'string' && typeof override.product_id === 'string';
}
