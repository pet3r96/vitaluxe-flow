-- Fix Testosterone Cream pricing directly
UPDATE products 
SET topline_price = 27.60, downline_price = 33.60
WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c' 
AND name = 'Testosterone Cream';

-- Fix Testosterone Cypionate pricing
UPDATE products 
SET topline_price = 24.88, downline_price = 30.26
WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c' 
AND name = 'Testosterone Cypionate';

-- Fix all Vios products with null topline/downline prices using a formula
-- topline = base_price * 1.4, downline = base_price * 1.7
UPDATE products 
SET 
  topline_price = ROUND((base_price * 1.4)::numeric, 2),
  downline_price = ROUND((base_price * 1.7)::numeric, 2)
WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c'
AND (topline_price IS NULL OR downline_price IS NULL);