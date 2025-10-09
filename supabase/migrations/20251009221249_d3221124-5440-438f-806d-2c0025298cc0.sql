-- Add user_id to pharmacies table to link to profiles
ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create unique constraint to ensure one pharmacy per user
ALTER TABLE public.pharmacies 
ADD CONSTRAINT unique_pharmacy_user UNIQUE (user_id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON public.pharmacies(user_id);

-- Clean up orphaned pharmacy records that have no user_id
DELETE FROM public.pharmacies WHERE user_id IS NULL;

-- Update RLS policies on order_lines to use user_id from pharmacies
DROP POLICY IF EXISTS "Pharmacies can update assigned order line status" ON public.order_lines;
DROP POLICY IF EXISTS "Pharmacies can view assigned order lines" ON public.order_lines;

CREATE POLICY "Pharmacies can update assigned order line status"
ON public.order_lines
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.pharmacies ph
    WHERE ph.id = order_lines.assigned_pharmacy_id 
    AND ph.user_id = auth.uid()
    AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);

CREATE POLICY "Pharmacies can view assigned order lines"
ON public.order_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.pharmacies ph
    WHERE ph.id = order_lines.assigned_pharmacy_id 
    AND ph.user_id = auth.uid()
    AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);