-- Create usage_logs table for tracking video session usage
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL,
  session_id UUID REFERENCES public.video_sessions(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patient_accounts(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'video',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for usage_logs
CREATE POLICY "Admins can view all usage logs"
  ON public.usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Practice owners can view their practice usage"
  ON public.usage_logs
  FOR SELECT
  USING (practice_id = auth.uid());

CREATE POLICY "Practice staff can view their practice usage"
  ON public.usage_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_staff
      WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = usage_logs.practice_id
      AND practice_staff.active = true
    )
  );

CREATE POLICY "Service role can insert usage logs"
  ON public.usage_logs
  FOR INSERT
  WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_practice_id ON public.usage_logs(practice_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_practice_date ON public.usage_logs(practice_id, created_at DESC);