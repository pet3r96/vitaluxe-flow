-- Enable RLS on orphan_storage_files table
ALTER TABLE orphan_storage_files ENABLE ROW LEVEL SECURITY;

-- Only admins can view orphaned files
CREATE POLICY "Admins can view orphaned files"
  ON orphan_storage_files
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );