-- Drop the problematic video session trigger that causes RLS issues
-- The edge functions already handle video session creation properly
DROP TRIGGER IF EXISTS create_video_session_trigger ON patient_appointments;
DROP FUNCTION IF EXISTS create_video_session_for_appointment();