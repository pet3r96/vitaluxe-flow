-- EasyPost API Integration Migration
-- Add tables and columns for EasyPost shipment tracking and address verification

-- Create easypost_shipments table to store shipment data
CREATE TABLE IF NOT EXISTS public.easypost_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  easypost_shipment_id text NOT NULL UNIQUE,
  order_line_id uuid REFERENCES public.order_lines(id) ON DELETE CASCADE NOT NULL,
  tracking_code text,
  carrier text,
  service text,
  status text,
  label_url text,
  tracking_url text,
  rate numeric(10,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create easypost_tracking_events table for tracking history
CREATE TABLE IF NOT EXISTS public.easypost_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  easypost_tracker_id text NOT NULL,
  order_line_id uuid REFERENCES public.order_lines(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  message text,
  description text,
  carrier text,
  tracking_details jsonb,
  event_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add easypost_address_id column to relevant tables
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS easypost_address_id text;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS easypost_address_id text;

ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS easypost_address_id text;

-- Add easypost_shipment_id column to order_lines
ALTER TABLE public.order_lines 
ADD COLUMN IF NOT EXISTS easypost_shipment_id text;

-- Add EasyPost API rate limits to existing config
INSERT INTO public.api_rate_limits_config (api_name, max_calls_per_day, max_calls_per_hour, cost_per_call)
VALUES 
  ('easypost_address_verification', 1000, 100, 0.05),
  ('easypost_shipment_creation', 100, 20, 0.10),
  ('easypost_tracking', 500, 50, 0.02)
ON CONFLICT (api_name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_easypost_shipments_order_line 
ON public.easypost_shipments(order_line_id);

CREATE INDEX IF NOT EXISTS idx_easypost_shipments_tracking_code 
ON public.easypost_shipments(tracking_code);

CREATE INDEX IF NOT EXISTS idx_easypost_tracking_events_order_line 
ON public.easypost_tracking_events(order_line_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_easypost_tracking_events_tracker_id 
ON public.easypost_tracking_events(easypost_tracker_id);

-- Enable RLS on new tables
ALTER TABLE public.easypost_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easypost_tracking_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for easypost_shipments
CREATE POLICY "Admins can view all EasyPost shipments"
ON public.easypost_shipments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can view shipments for their assigned orders"
ON public.easypost_shipments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ol.id = order_line_id 
    AND ph.user_id = auth.uid()
    AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);

CREATE POLICY "Doctors can view shipments for their orders"
ON public.easypost_shipments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.id = order_line_id 
    AND o.doctor_id = auth.uid()
    AND has_role(auth.uid(), 'doctor'::app_role)
  )
);

CREATE POLICY "System can insert EasyPost shipments"
ON public.easypost_shipments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update EasyPost shipments"
ON public.easypost_shipments FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for easypost_tracking_events
CREATE POLICY "Admins can view all tracking events"
ON public.easypost_tracking_events FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can view tracking events for their orders"
ON public.easypost_tracking_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ol.id = order_line_id 
    AND ph.user_id = auth.uid()
    AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);

CREATE POLICY "Doctors can view tracking events for their orders"
ON public.easypost_tracking_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.id = order_line_id 
    AND o.doctor_id = auth.uid()
    AND has_role(auth.uid(), 'doctor'::app_role)
  )
);

CREATE POLICY "System can insert tracking events"
ON public.easypost_tracking_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_easypost_shipments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_easypost_shipments_updated_at
  BEFORE UPDATE ON public.easypost_shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_easypost_shipments_updated_at();
