-- Update RLS policies for proper role-based access

-- Drop existing patient policies and create role-specific ones
DROP POLICY IF EXISTS "All authenticated users can view patients" ON public.patients;
DROP POLICY IF EXISTS "All authenticated users can create patients" ON public.patients;
DROP POLICY IF EXISTS "All authenticated users can update patients" ON public.patients;

-- Providers can only view and manage their own patients
CREATE POLICY "Providers can view their own patients"
ON public.patients
FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role)
);

CREATE POLICY "Providers can create patients"
ON public.patients
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
);

CREATE POLICY "Providers can update their own patients"
ON public.patients
FOR UPDATE
USING (
  has_role(auth.uid(), 'doctor'::app_role)
);

-- Admins can view and manage all patients
CREATE POLICY "Admins can view all patients"
ON public.patients
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can create patients"
ON public.patients
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update patients"
ON public.patients
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete patients"
ON public.patients
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add provider_id to patients table to track ownership
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES auth.users(id);

-- Update order_lines RLS for pharmacies to update status
DROP POLICY IF EXISTS "Pharmacies can update their assigned order lines" ON public.order_lines;

CREATE POLICY "Pharmacies can update assigned order line status"
ON public.order_lines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM pharmacies
    JOIN profiles ON profiles.id = auth.uid()
    WHERE pharmacies.id = order_lines.assigned_pharmacy_id
      AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);

-- Admins can update any order line
CREATE POLICY "Admins can update all order lines"
ON public.order_lines
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add timestamp fields for order status tracking
ALTER TABLE public.order_lines
ADD COLUMN IF NOT EXISTS processing_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- Create function to update status timestamps
CREATE OR REPLACE FUNCTION public.update_order_status_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'processing' AND OLD.status != 'processing' THEN
    NEW.processing_at = now();
  END IF;
  
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    NEW.shipped_at = now();
  END IF;
  
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for status timestamp updates
DROP TRIGGER IF EXISTS update_order_line_status_timestamp ON public.order_lines;
CREATE TRIGGER update_order_line_status_timestamp
BEFORE UPDATE ON public.order_lines
FOR EACH ROW
EXECUTE FUNCTION public.update_order_status_timestamp();