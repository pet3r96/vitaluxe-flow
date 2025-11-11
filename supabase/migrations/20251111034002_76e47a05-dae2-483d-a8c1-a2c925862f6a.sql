-- Fix video session channel naming for Agora compatibility
-- Phase 1: Update trigger function + migrate existing sessions

-- Update the trigger function to use Agora-friendly channel naming
CREATE OR REPLACE FUNCTION create_video_session_for_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_type = 'video' AND NEW.status IN ('scheduled', 'confirmed') THEN
    -- Use underscores instead of hyphens, prefix with 'vlx_' (VitaluxePro)
    INSERT INTO video_sessions (
      appointment_id, practice_id, patient_id, provider_id,
      channel_name, scheduled_start_time, status
    ) VALUES (
      NEW.id, NEW.practice_id, NEW.patient_id, NEW.provider_id,
      'vlx_' || replace(NEW.id::text, '-', '_'), 
      NEW.start_time, 'scheduled'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing sessions to new format (active/waiting/scheduled sessions only)
UPDATE video_sessions
SET channel_name = 'vlx_' || replace(appointment_id::text, '-', '_')
WHERE status IN ('scheduled', 'waiting', 'active')
  AND (channel_name LIKE 'session_%' OR channel_name LIKE 'apt_%');

-- Add comment for documentation
COMMENT ON FUNCTION create_video_session_for_appointment IS 
  'Auto-creates video sessions with Agora-friendly channel names (vlx_<uuid_with_underscores>)';