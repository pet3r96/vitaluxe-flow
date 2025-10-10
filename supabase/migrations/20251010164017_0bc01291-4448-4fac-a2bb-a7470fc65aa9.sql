-- Add requires_prescription column to products table
ALTER TABLE products 
ADD COLUMN requires_prescription BOOLEAN NOT NULL DEFAULT false;

-- Add index for filtering
CREATE INDEX idx_products_requires_prescription ON products(requires_prescription);

-- Set random 5 products to require prescriptions for testing
WITH random_products AS (
  SELECT id 
  FROM products 
  ORDER BY RANDOM() 
  LIMIT 5
)
UPDATE products 
SET requires_prescription = true 
WHERE id IN (SELECT id FROM random_products);

COMMENT ON COLUMN products.requires_prescription IS 'Whether this product requires a prescription to be uploaded when ordering';

-- RLS policies for prescriptions storage bucket
-- Allow practices/providers to upload prescriptions
CREATE POLICY "Practices and providers can upload prescriptions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prescriptions' AND
  (
    has_role(auth.uid(), 'doctor'::app_role) OR 
    has_role(auth.uid(), 'provider'::app_role)
  )
);

-- Allow practices/providers/admin to view their own prescriptions
CREATE POLICY "Users can view their prescriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'prescriptions' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    auth.uid()::text = split_part(name, '/', 1)
  )
);

-- Allow pharmacies to view prescriptions for their assigned orders
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
      AND ol.prescription_url = storage.objects.name
  )
);