-- Allow users to view impersonation logs where they were the target
CREATE POLICY "Users can view their own impersonation logs"
ON impersonation_logs
FOR SELECT
TO authenticated
USING (auth.uid() = target_user_id);