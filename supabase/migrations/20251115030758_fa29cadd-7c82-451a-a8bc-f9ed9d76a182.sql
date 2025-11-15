-- ============================================================================
-- USE ALTER FUNCTION to force search_path setting
-- CREATE OR REPLACE doesn't persist the configuration, so we ALTER instead
-- ============================================================================

ALTER FUNCTION public.create_video_session_for_appointment() SET search_path TO 'public';
ALTER FUNCTION public.generate_guest_token() SET search_path TO 'public';
ALTER FUNCTION public.generate_room_key() SET search_path TO 'public';
ALTER FUNCTION public.get_appointments_during_blocked_time(uuid, uuid, timestamptz, timestamptz) SET search_path TO 'public';
ALTER FUNCTION public.get_practice_team_members(uuid) SET search_path TO 'public';
ALTER FUNCTION public.get_primary_role(uuid) SET search_path TO 'public';
ALTER FUNCTION public.log_patient_status_change() SET search_path TO 'public';
ALTER FUNCTION public.notify_appointment_alert() SET search_path TO 'public';
ALTER FUNCTION public.notify_due_follow_ups() SET search_path TO 'public';
ALTER FUNCTION public.notify_follow_up_scheduled() SET search_path TO 'public';
ALTER FUNCTION public.sync_patient_address_to_account() SET search_path TO 'public';
ALTER FUNCTION public.validate_patient_reschedule_update() SET search_path TO 'public';