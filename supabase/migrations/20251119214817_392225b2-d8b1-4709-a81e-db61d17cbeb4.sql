-- Drop problematic appointment alert trigger and function
-- These reference tables that may have been altered or removed in later migrations
-- Edge functions handle appointment creation without issues

DROP TRIGGER IF EXISTS appointment_alert_trigger ON patient_appointments CASCADE;
DROP FUNCTION IF EXISTS notify_appointment_alert() CASCADE;