-- Add report_notes column to orders table for provider reporting
ALTER TABLE public.orders
  ADD COLUMN report_notes TEXT;

-- Update RLS policy to allow providers and admins to update report_notes
-- The existing policies already cover this, but let's ensure it's explicit
CREATE POLICY "Providers and admins can update report notes"
ON public.orders
FOR UPDATE
USING (
  auth.uid() = doctor_id OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = doctor_id OR has_role(auth.uid(), 'admin'::app_role)
);