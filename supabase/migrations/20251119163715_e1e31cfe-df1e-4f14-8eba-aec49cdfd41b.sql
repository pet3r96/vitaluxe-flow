-- Populate default shipping rates for Demo Pharmacy 1
-- Ensures cart pages have available shipping options
INSERT INTO pharmacy_shipping_rates (pharmacy_id, shipping_speed, rate, enabled)
SELECT 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid, 'ground', 15.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_shipping_rates 
  WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid
  AND shipping_speed = 'ground'
)
UNION ALL
SELECT 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid, '2day', 25.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_shipping_rates 
  WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid
  AND shipping_speed = '2day'
)
UNION ALL
SELECT 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid, 'overnight', 35.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM pharmacy_shipping_rates 
  WHERE pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c'::uuid
  AND shipping_speed = 'overnight'
);