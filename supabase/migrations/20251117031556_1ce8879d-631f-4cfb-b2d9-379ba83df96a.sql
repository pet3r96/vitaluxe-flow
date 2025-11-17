-- Create user_terms_acceptances table
CREATE TABLE IF NOT EXISTS public.user_terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  terms_id UUID,
  role app_role NOT NULL,
  version INTEGER NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Admins can view all acceptances
CREATE POLICY "Admins can view all acceptances"
  ON public.user_terms_acceptances
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own acceptances
CREATE POLICY "Users can view own acceptances"
  ON public.user_terms_acceptances
  FOR SELECT
  USING (user_id = auth.uid());

-- System can insert acceptances
CREATE POLICY "System can insert acceptances"
  ON public.user_terms_acceptances
  FOR INSERT
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_terms_acceptances_user_id ON public.user_terms_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_terms_acceptances_terms_id ON public.user_terms_acceptances(terms_id);
CREATE INDEX IF NOT EXISTS idx_user_terms_acceptances_accepted_at ON public.user_terms_acceptances(accepted_at DESC);