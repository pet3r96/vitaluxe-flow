-- 1. Add destination_state column to order_lines
ALTER TABLE order_lines
ADD COLUMN IF NOT EXISTS destination_state text;

-- 2. Backfill destination_state from patient_address for existing records
UPDATE order_lines
SET destination_state = SUBSTRING(patient_address FROM ',\s*([A-Z]{2})\s+\d{5}')
WHERE destination_state IS NULL AND patient_address IS NOT NULL;

-- 3. Assign all products to Test Pharma if they have no pharmacy assignments
INSERT INTO product_pharmacies (product_id, pharmacy_id)
SELECT 
  p.id,
  '22e7801e-f9ff-40f1-a926-968f3a8065ec'::uuid -- Test Pharma ID
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_pharmacies pp 
  WHERE pp.product_id = p.id
)
ON CONFLICT DO NOTHING;

-- 4. Update all existing order_lines with NULL pharmacy to Test Pharma
UPDATE order_lines
SET assigned_pharmacy_id = '22e7801e-f9ff-40f1-a926-968f3a8065ec'::uuid,
    updated_at = now()
WHERE assigned_pharmacy_id IS NULL;

-- 5. Drop and recreate RLS policy with NULL check
DROP POLICY IF EXISTS "Pharmacies can view assigned order lines" ON order_lines;

CREATE POLICY "Pharmacies can view assigned order lines"
ON order_lines
FOR SELECT
TO authenticated
USING (
  assigned_pharmacy_id IS NOT NULL 
  AND EXISTS (
    SELECT 1
    FROM pharmacies ph
    WHERE ph.id = order_lines.assigned_pharmacy_id
      AND ph.user_id = auth.uid()
      AND has_role(auth.uid(), 'pharmacy'::app_role)
  )
);