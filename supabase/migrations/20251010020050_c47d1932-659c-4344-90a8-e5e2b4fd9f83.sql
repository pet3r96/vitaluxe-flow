-- Enable realtime for orders and order_lines tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_lines;

-- Ensure audit logs can be inserted by system
COMMENT ON TABLE public.audit_logs IS 'System-wide audit trail for all user actions and address verifications';
COMMENT ON TABLE public.notification_preferences IS 'User notification preferences for order status updates';

-- Create index for faster impersonation log queries
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_impersonator ON public.impersonation_logs(impersonator_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_target ON public.impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_logs_created_at ON public.impersonation_logs(created_at DESC);