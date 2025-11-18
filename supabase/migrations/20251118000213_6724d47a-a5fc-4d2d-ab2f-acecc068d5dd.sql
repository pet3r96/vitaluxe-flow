-- Add correlation_id support to audit_logs for request tracing
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS correlation_id TEXT;

-- Create index for correlation_id lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id 
ON audit_logs(correlation_id) 
WHERE correlation_id IS NOT NULL;

-- Create composite index for dashboard queries (without time predicate)
CREATE INDEX IF NOT EXISTS idx_audit_logs_dashboard 
ON audit_logs(created_at DESC, action_type, user_id);

-- Create GIN index for JSONB details full-text search
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin 
ON audit_logs USING GIN(details);

-- Create storage bucket for audit reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audit-reports',
  'audit-reports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/json', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for audit-reports bucket (admin-only access)
CREATE POLICY "Admin users can upload audit reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audit-reports' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admin users can view audit reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'audit-reports' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admin users can delete audit reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'audit-reports' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);