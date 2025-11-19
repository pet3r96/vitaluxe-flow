-- Phase 2: Fix Search Path on SECURITY DEFINER Functions
-- This fixes the 26 search_path linter warnings

ALTER FUNCTION public.sync_patient_name() SET search_path = public;
ALTER FUNCTION public.log_patient_phi_access(uuid, text, jsonb, text, text, text) SET search_path = public;
ALTER FUNCTION public.get_decrypted_patient_phi(uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_sms_codes() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_reset_tokens() SET search_path = public;
ALTER FUNCTION public.disable_auth_user(uuid) SET search_path = public;
ALTER FUNCTION public.get_client_ip() SET search_path = public;
ALTER FUNCTION public.decrypt_profile_contact(text, text) SET search_path = public;
ALTER FUNCTION public.decrypt_2fa_phone(text) SET search_path = public;
ALTER FUNCTION public.encrypt_2fa_phone() SET search_path = public;
ALTER FUNCTION public.increment_discount_usage(text) SET search_path = public;
ALTER FUNCTION public.validate_discount_code(text) SET search_path = public;
ALTER FUNCTION public.decrypt_plaid_token(text) SET search_path = public;
ALTER FUNCTION public.refresh_security_events_summary() SET search_path = public;
ALTER FUNCTION public.encrypt_profile_contact() SET search_path = public;
ALTER FUNCTION public.encrypt_prescription_data() SET search_path = public;
ALTER FUNCTION public.get_user_rep_id(uuid) SET search_path = public;
ALTER FUNCTION public.decrypt_order_line_contact(text, text) SET search_path = public;
ALTER FUNCTION public.decrypt_cart_phi(text, text) SET search_path = public;
ALTER FUNCTION public.encrypt_cart_line_phi() SET search_path = public;
ALTER FUNCTION public.log_prescription_access() SET search_path = public;
ALTER FUNCTION public.log_patient_access() SET search_path = public;
ALTER FUNCTION public.update_order_status() SET search_path = public;
ALTER FUNCTION public.archive_old_audit_logs() SET search_path = public;
ALTER FUNCTION public.create_video_session_for_appointment() SET search_path = public;
ALTER FUNCTION public.get_auth_user_id_by_email(text) SET search_path = public;