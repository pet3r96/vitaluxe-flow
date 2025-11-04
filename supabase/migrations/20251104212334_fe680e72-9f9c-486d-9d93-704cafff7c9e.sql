-- Enable instant realtime updates for all critical tables
-- This eliminates the 4-minute delay by broadcasting changes immediately

-- Add all critical tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.providers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_blocked_time;

-- Set REPLICA IDENTITY FULL to send complete row data in realtime events
-- This allows clients to see full updates without additional queries
ALTER TABLE public.patient_appointments REPLICA IDENTITY FULL;
ALTER TABLE public.practice_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.patient_notes REPLICA IDENTITY FULL;
ALTER TABLE public.providers REPLICA IDENTITY FULL;
ALTER TABLE public.practice_staff REPLICA IDENTITY FULL;
ALTER TABLE public.treatment_plans REPLICA IDENTITY FULL;
ALTER TABLE public.practice_blocked_time REPLICA IDENTITY FULL;
ALTER TABLE public.patient_follow_ups REPLICA IDENTITY FULL;