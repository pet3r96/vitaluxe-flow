-- Phase 2: Add Missing Admin RLS Policies
-- This migration adds admin policies to 4 critical tables that were missing them

-- 1. audit_logs admin policy
CREATE POLICY audit_logs_admin_all ON public.audit_logs
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 2. patient_accounts admin policy
CREATE POLICY patient_accounts_admin_all ON public.patient_accounts
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. prescriptions admin policy
CREATE POLICY prescriptions_admin_all ON public.prescriptions
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 4. video_sessions admin policy
CREATE POLICY video_sessions_admin_all ON public.video_sessions
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_practice_id ON public.patient_accounts(practice_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_account_id ON public.prescriptions(patient_account_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_practice_id ON public.video_sessions(practice_id);