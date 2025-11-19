-- Attach normalization triggers to all required tables
-- These functions already exist, we just need to attach the triggers

-- Email normalization trigger for profiles
DROP TRIGGER IF EXISTS trigger_normalize_email_profiles ON profiles;
CREATE TRIGGER trigger_normalize_email_profiles
  BEFORE INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION normalize_email();

-- Email normalization trigger for patient_accounts
DROP TRIGGER IF EXISTS trigger_normalize_email_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_email_patient_accounts
  BEFORE INSERT OR UPDATE OF email ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION normalize_email();

-- Phone normalization trigger for profiles
DROP TRIGGER IF EXISTS trigger_normalize_phone_profiles ON profiles;
CREATE TRIGGER trigger_normalize_phone_profiles
  BEFORE INSERT OR UPDATE OF phone ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_phone();

-- Phone normalization trigger for patient_accounts
DROP TRIGGER IF EXISTS trigger_normalize_phone_patient_accounts ON patient_accounts;
CREATE TRIGGER trigger_normalize_phone_patient_accounts
  BEFORE INSERT OR UPDATE OF phone ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_phone();

-- Phone normalization trigger for pharmacies
DROP TRIGGER IF EXISTS trigger_normalize_phone_pharmacies ON pharmacies;
CREATE TRIGGER trigger_normalize_phone_pharmacies
  BEFORE INSERT OR UPDATE OF phone ON pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_normalize_phone();

-- Fix search_path for all functions missing it
-- This fixes the 24 linter warnings

ALTER FUNCTION public.auto_add_pharmacy_home_state() SET search_path = public;
ALTER FUNCTION public.sync_patient_name() SET search_path = public;
ALTER FUNCTION public.update_provider_documents_updated_at() SET search_path = public;
ALTER FUNCTION public.update_form_submissions_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.set_session_created_at() SET search_path = public;
ALTER FUNCTION public.sync_video_session_on_appointment_complete() SET search_path = public;
ALTER FUNCTION public.validate_trial_period() SET search_path = public;
ALTER FUNCTION public.check_single_primary_role() SET search_path = public;
ALTER FUNCTION public.update_notification_preferences_updated_at() SET search_path = public;
ALTER FUNCTION public.detect_concurrent_sessions() SET search_path = public;
ALTER FUNCTION public.log_admin_role_assignment() SET search_path = public;
ALTER FUNCTION public.update_order_payment_status_on_refund() SET search_path = public;
ALTER FUNCTION public.log_cart_line_access() SET search_path = public;
ALTER FUNCTION public.log_payment_method_access() SET search_path = public;
ALTER FUNCTION public.handle_patient_email_change() SET search_path = public;
ALTER FUNCTION public.log_credential_decryption() SET search_path = public;
ALTER FUNCTION public.calculate_order_line_profit() SET search_path = public;
ALTER FUNCTION public.check_order_has_lines() SET search_path = public;
ALTER FUNCTION public.generate_ticket_number() SET search_path = public;
ALTER FUNCTION public.set_ticket_number() SET search_path = public;
ALTER FUNCTION public.update_support_ticket_timestamp() SET search_path = public;
ALTER FUNCTION public.normalize_phone(text) SET search_path = public;
ALTER FUNCTION public.trigger_normalize_phone() SET search_path = public;