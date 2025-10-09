-- Create sync_logs table to track data synchronization events
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  added_profiles integer NOT NULL DEFAULT 0,
  added_roles integer NOT NULL DEFAULT 0,
  repaired_pharmacies integer NOT NULL DEFAULT 0,
  repaired_providers integer NOT NULL DEFAULT 0,
  repaired_toplines integer NOT NULL DEFAULT 0,
  repaired_downlines integer NOT NULL DEFAULT 0,
  total_repaired integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_admin_id ON public.sync_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_executed_at ON public.sync_logs(executed_at DESC);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Only authorized admin can view sync logs
CREATE POLICY "Only authorized admin can view sync logs"
ON public.sync_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE users.id = auth.uid()
    AND users.email = 'admin@vitaluxeservice.com'
  )
);

-- System can insert sync logs
CREATE POLICY "System can insert sync logs"
ON public.sync_logs
FOR INSERT
WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.sync_logs IS 'Tracks data synchronization events run by admin to repair user-role mappings';
COMMENT ON COLUMN public.sync_logs.summary IS 'JSON object containing detailed sync results and any errors encountered';