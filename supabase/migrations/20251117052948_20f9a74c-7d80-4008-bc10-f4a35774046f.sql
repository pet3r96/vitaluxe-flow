-- Create audit table for RLS checks
CREATE TABLE IF NOT EXISTS public.rls_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  rls_enabled boolean NOT NULL,
  issue_type text,
  details text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the audit table itself
ALTER TABLE public.rls_audit_results ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit results
CREATE POLICY "Admins view RLS audit results"
  ON public.rls_audit_results
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- System can insert audit results
CREATE POLICY "System inserts RLS audit results"
  ON public.rls_audit_results
  FOR INSERT
  WITH CHECK (true);