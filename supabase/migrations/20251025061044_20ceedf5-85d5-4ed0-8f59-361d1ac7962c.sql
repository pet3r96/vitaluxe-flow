-- Create order_routing_log table for audit trail
CREATE TABLE IF NOT EXISTS public.order_routing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  destination_state TEXT NOT NULL,
  user_topline_rep_id UUID,
  eligible_pharmacies JSONB,
  selected_pharmacy_id UUID,
  selected_pharmacy_name TEXT,
  selection_reason TEXT,
  priority_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for querying by product and state
CREATE INDEX IF NOT EXISTS idx_order_routing_log_product_state 
  ON public.order_routing_log(product_id, destination_state);

-- Add index for querying by pharmacy
CREATE INDEX IF NOT EXISTS idx_order_routing_log_pharmacy 
  ON public.order_routing_log(selected_pharmacy_id);

-- Add index for querying by timestamp
CREATE INDEX IF NOT EXISTS idx_order_routing_log_created_at 
  ON public.order_routing_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.order_routing_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all routing logs
CREATE POLICY "Admins can view all routing logs"
  ON public.order_routing_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'::app_role
    )
  );

-- Allow pharmacies to view logs for their pharmacy
CREATE POLICY "Pharmacies can view their routing logs"
  ON public.order_routing_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pharmacies
      WHERE user_id = auth.uid()
        AND id = selected_pharmacy_id
    )
  );

-- Allow system to insert routing logs
CREATE POLICY "System can insert routing logs"
  ON public.order_routing_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);