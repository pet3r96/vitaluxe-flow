-- Fix remaining search_path warnings for SECURITY DEFINER functions
-- This completes the Phase 2 security lockdown

ALTER FUNCTION public.archive_all_logs() SET search_path = public;
ALTER FUNCTION public.archive_old_audit_logs() SET search_path = public;
ALTER FUNCTION public.auto_link_patient_to_auth_user() SET search_path = public;
ALTER FUNCTION public.calculate_practice_video_bill(uuid, timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.can_access_practice_messages(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.can_access_practice_orders(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.can_act_for_practice(uuid) SET search_path = public;
ALTER FUNCTION public.can_cancel_order(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.can_view_credentials(uuid) SET search_path = public;
ALTER FUNCTION public.cleanup_expired_impersonation_sessions() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_sms_attempts() SET search_path = public;
ALTER FUNCTION public.count_pharmacy_orders(uuid) SET search_path = public;
ALTER FUNCTION public.count_provider_orders(uuid) SET search_path = public;
ALTER FUNCTION public.create_user_with_role(uuid, text, text, app_role, jsonb) SET search_path = public;
ALTER FUNCTION public.decrypt_prescriber_credential(text, text) SET search_path = public;
ALTER FUNCTION public.fix_orphaned_patient_accounts() SET search_path = public;
ALTER FUNCTION public.get_current_user_rep_id() SET search_path = public;
ALTER FUNCTION public.get_decrypted_order_line_contact(uuid) SET search_path = public;
ALTER FUNCTION public.get_discount_code_stats(text) SET search_path = public;
ALTER FUNCTION public.get_my_topline_rep_id() SET search_path = public;
ALTER FUNCTION public.get_rep_earnings(uuid) SET search_path = public;
ALTER FUNCTION public.get_topline_rep_id_for_practice(uuid) SET search_path = public;
ALTER FUNCTION public.get_visible_pharmacies_for_effective_user(uuid) SET search_path = public;
ALTER FUNCTION public.get_visible_products_for_user() SET search_path = public;
ALTER FUNCTION public.is_admin_ip_banned() SET search_path = public;
ALTER FUNCTION public.is_cart_owner(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_downline_of_topline(uuid) SET search_path = public;
ALTER FUNCTION public.is_topline_of_rep(uuid) SET search_path = public;
ALTER FUNCTION public.pharmacy_can_view_order(uuid, uuid) SET search_path = public;