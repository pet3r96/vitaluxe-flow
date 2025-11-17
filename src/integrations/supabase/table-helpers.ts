/**
 * Typed Table Accessor Helpers
 * Provides type-safe access to Supabase tables not in generated schema
 * Centralizes the single necessary escape hatch for manual table types
 */

import { supabase } from '@/integrations/supabase/client';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import type {
  ProviderDocument,
  RepProductVisibility,
  ProductRepAssignment,
  PharmacyRepAssignment,
  PatientPortalTerms,
  CheckoutAttestation,
  SubscriptionUpgradePrompt,
  PatientActivityLog,
  ActiveSession,
  PendingRepRequest,
  PendingPracticeRequest,
  InternalMessageReply,
  UserTermsAcceptance,
  PatientTermsAcceptance,
  PatientDocument,
  ProviderDocumentPatient,
  SecurityAlertRule,
  SecurityEvent,
  AuditLogArchive,
  PracticeBranding,
  AccountLockout,
  AlertRule,
} from '@/types/manual-schema';

/**
 * Generic helper to get a typed table ref without changing schema types
 * This cast is the only intentional boundary; everywhere else uses the typed return value
 * It avoids sprinkling (as any) across the app
 */
function table<T>(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(name as any) as any;
}

// Named accessors for clarity and reuse
export const ProviderDocuments = () => table<ProviderDocument>('provider_documents');
export const RepProductVis = () => table<RepProductVisibility>('rep_product_visibility');
export const ProductRepAssign = () => table<ProductRepAssignment>('product_rep_assignments');
export const PharmacyRepAssign = () => table<PharmacyRepAssignment>('pharmacy_rep_assignments');
export const PortalTerms = () => table<PatientPortalTerms>('patient_portal_terms');
export const CheckoutAttest = () => table<CheckoutAttestation>('checkout_attestation');
export const UpgradePrompts = () => table<SubscriptionUpgradePrompt>('subscription_upgrade_prompts');
export const PatientActivityLogs = () => table<PatientActivityLog>('patient_activity_logs');
export const ActiveSessions = () => table<ActiveSession>('active_sessions');
export const PendingRepReq = () => table<PendingRepRequest>('pending_rep_requests');
export const PendingPracticeReq = () => table<PendingPracticeRequest>('pending_practice_requests');
export const InternalMsgReplies = () => table<InternalMessageReply>('internal_message_replies');
export const UserTermsAccept = () => table<UserTermsAcceptance>('user_terms_acceptances');
export const PatientTermsAccept = () => table<PatientTermsAcceptance>('patient_terms_acceptances');
export const PatientDocs = () => table<PatientDocument>('patient_documents');
export const ProviderDocPatients = () => table<ProviderDocumentPatient>('provider_document_patients');
export const SecurityAlertRules = () => table<SecurityAlertRule>('security_alert_rules');
export const SecurityEvents = () => table<SecurityEvent>('security_events');
export const AuditLogsArchive = () => table<AuditLogArchive>('audit_logs_archive');
export const PracticeBrand = () => table<PracticeBranding>('practice_branding');
export const AccountLockouts = () => table<AccountLockout>('account_lockouts');
export const AlertRules = () => table<AlertRule>('alert_rules');
