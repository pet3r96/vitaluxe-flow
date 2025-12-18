-- Drop existing policy that doesn't work for root-level files
DROP POLICY IF EXISTS "Practices and providers can view their prescriptions" ON storage.objects;

-- Create improved policy that handles both folder-based and root-level prescription files
CREATE POLICY "Practices and providers can view their prescriptions v2"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions'
  AND (
    public.has_role(auth.uid(), 'doctor') 
    OR public.has_role(auth.uid(), 'provider')
  )
  AND (
    -- Handle folder-based paths (user_id/filename.pdf)
    (auth.uid())::text = split_part(name, '/', 1)
    OR
    -- Handle root-level files by checking order_lines ownership
    EXISTS (
      SELECT 1 FROM public.order_lines ol
      JOIN public.orders o ON o.id = ol.order_id
      WHERE ol.prescription_url LIKE '%' || storage.objects.name
      AND o.doctor_id = auth.uid()
    )
  )
);