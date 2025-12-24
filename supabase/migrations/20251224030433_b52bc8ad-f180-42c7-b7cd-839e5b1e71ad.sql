
-- Consolidate Testosterone Cream products
-- Step 1: Delete variants from legacy products
DELETE FROM product_variants 
WHERE product_id IN (
  SELECT id FROM products 
  WHERE name IN ('Testosterone Cream (Men)', 'Testosterone Cream (Women)')
);

-- Step 2: Delete legacy products
DELETE FROM products 
WHERE name IN ('Testosterone Cream (Men)', 'Testosterone Cream (Women)');

-- Step 3: Delete existing generic variants from unified Testosterone Cream
DELETE FROM product_variants 
WHERE product_id = (SELECT id FROM products WHERE name = 'Testosterone Cream' LIMIT 1);

-- Step 4: Insert gender-specific variants with correct pricing for unified Testosterone Cream
-- Men's variants (from Excel)
INSERT INTO product_variants (product_id, dosage_label, base_price, topline_price, downline_price, retail_price, active, sort_order)
SELECT 
  (SELECT id FROM products WHERE name = 'Testosterone Cream' LIMIT 1),
  dosage_label,
  base_price,
  topline_price,
  downline_price,
  retail_price,
  true,
  sort_order
FROM (VALUES
  ('50mg/mL - 30g (Men)', 19.71, 27.60, 33.60, 37.60, 1),
  ('50mg/mL - 60g (Men)', 26.71, 37.40, 45.50, 50.90, 2),
  ('100mg/mL - 30g (Men)', 19.71, 27.60, 33.60, 37.60, 3),
  ('100mg/mL - 60g (Men)', 26.71, 37.40, 45.50, 50.90, 4),
  ('150mg/mL - 30g (Men)', 19.71, 27.60, 33.60, 37.60, 5),
  ('200mg/mL - 30g (Men)', 19.71, 27.60, 33.60, 37.60, 6),
  ('200mg/mL - 60g (Men)', 26.71, 37.40, 45.50, 50.90, 7),
  ('250mg/mL - 30g (Men)', 19.71, 27.60, 33.60, 37.60, 8),
  -- Women's variants (from Excel - lower concentrations)
  ('1mg/mL - 30g (Women)', 19.71, 27.60, 33.60, 37.60, 9),
  ('2mg/mL - 30g (Women)', 19.71, 27.60, 33.60, 37.60, 10),
  ('5mg/mL - 30g (Women)', 19.71, 27.60, 33.60, 37.60, 11),
  ('10mg/mL - 30g (Women)', 19.71, 27.60, 33.60, 37.60, 12)
) AS v(dosage_label, base_price, topline_price, downline_price, retail_price, sort_order);
