-- Drop ALL existing prescription-related policies on storage.objects
DROP POLICY IF EXISTS "Doctors can upload prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Doctors can view their own prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacies can view assigned prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Practices and providers can upload prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Practices and providers can view their prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Pharmacies can view prescriptions for assigned orders" ON storage.objects;
DROP POLICY IF EXISTS "Practices and providers can delete their prescriptions" ON storage.objects;

-- Comprehensive INSERT policy for doctors, providers, and admins
CREATE POLICY "Practices and providers can upload prescriptions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prescriptions' AND (
    has_role(auth.uid(), 'doctor'::app_role) OR 
    has_role(auth.uid(), 'provider'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- SELECT Policy 1: Admins can view all prescriptions
CREATE POLICY "Admins can view all prescriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions' AND 
  has_role(auth.uid(), 'admin'::app_role)
);

-- SELECT Policy 2: Doctors and Providers can view their own prescriptions
CREATE POLICY "Practices and providers can view their prescriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions' AND (
    has_role(auth.uid(), 'doctor'::app_role) OR 
    has_role(auth.uid(), 'provider'::app_role)
  ) AND
  (auth.uid())::text = split_part(name, '/', 1)
);

-- SELECT Policy 3: Pharmacies can view prescriptions for assigned orders
CREATE POLICY "Pharmacies can view prescriptions for assigned orders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions' AND
  has_role(auth.uid(), 'pharmacy'::app_role) AND
  EXISTS (
    SELECT 1
    FROM order_lines ol
    JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ph.user_id = auth.uid()
      AND ol.prescription_url LIKE '%' || objects.name || '%'
  )
);

-- DELETE policy for cleanup/corrections
CREATE POLICY "Practices and providers can delete their prescriptions"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prescriptions' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role)) AND
      (auth.uid())::text = split_part(name, '/', 1)
    )
  )
);