-- Add DELETE policy for pharmacy_webhook_events (currently missing)
CREATE POLICY "Admins can delete webhook events"
ON public.pharmacy_webhook_events
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = ANY (ARRAY['admin'::app_role, 'super_admin'::app_role])
  )
);