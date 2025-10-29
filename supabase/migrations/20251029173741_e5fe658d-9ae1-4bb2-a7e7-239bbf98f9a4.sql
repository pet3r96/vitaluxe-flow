-- Simplify patient RLS policies by removing redundant ones
-- The "Patients select/insert/update" policies with can_act_for_practice already handle practice access
-- The "Prevent cross-practice access" is redundant with existing policies
DROP POLICY IF EXISTS "Practices can view their own patients" ON public.patients;
DROP POLICY IF EXISTS "Prevent cross-practice access" ON public.patients;

-- Enable realtime on required tables for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_document_patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_follow_ups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;