-- Function to sync video_session status when appointment is completed or cancelled
CREATE OR REPLACE FUNCTION sync_video_session_on_appointment_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- If appointment is marked completed/cancelled, end the video session
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    UPDATE video_sessions
    SET 
      status = 'ended',
      end_time = COALESCE(end_time, NOW())
    WHERE appointment_id = NEW.id 
      AND status IN ('scheduled', 'waiting', 'active');
    
    -- Log the sync action
    RAISE NOTICE 'Auto-ended video session for appointment % (status: %)', NEW.id, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_video_session_trigger ON patient_appointments;

-- Create trigger on patient_appointments
CREATE TRIGGER sync_video_session_trigger
  AFTER UPDATE ON patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_video_session_on_appointment_complete();

-- One-time cleanup of existing zombie sessions
UPDATE video_sessions vs
SET status = 'ended', end_time = NOW()
FROM patient_appointments pa
WHERE vs.appointment_id = pa.id
  AND vs.status IN ('scheduled', 'waiting', 'active')
  AND pa.status IN ('completed', 'cancelled');

COMMENT ON FUNCTION sync_video_session_on_appointment_complete IS 'Automatically ends video sessions when appointments are completed or cancelled';
COMMENT ON TRIGGER sync_video_session_trigger ON patient_appointments IS 'Keeps video_sessions status in sync with patient_appointments status';