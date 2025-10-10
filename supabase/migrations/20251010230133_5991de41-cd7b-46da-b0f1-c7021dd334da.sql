-- Swap topline_price and downline_price for all 10 products
-- This fixes the inverted pricing where toplines were paying more than downlines
UPDATE products 
SET 
  topline_price = downline_price,
  downline_price = topline_price,
  updated_at = now()
WHERE id IN (
  'f8d71cf3-2b82-48a9-acfd-73f2ae1ff487', -- Tirzepatide 2.5mg
  'fda7ed1f-28c5-47eb-bc6e-0149617219f6', -- Tirzepatide 5.0mg
  '9fcf0883-e086-4e98-8859-4273879d5cd3', -- Vitamin B12 1000mcg
  '42addf92-9469-457b-bba8-519d0e1fa115', -- Tirzepatide 7.5mg
  '8da16e33-dca1-4932-956c-6b672e3d2782', -- Testosterone Cypionate 200mg
  '4b275355-8a5a-44c9-9e5d-ec8affdf0bd5', -- Semaglutide 0.25mg
  '657bb918-9b24-46b2-aab2-c562702bb32c', -- Semaglutide 0.5mg
  'af859477-de9f-46e3-a19b-60ce0b4c9354', -- Semaglutide 1.0mg
  '22c94c87-a32f-496f-abc7-367f5b091e5e', -- NAD+ 100mg
  '8c39dae7-3c71-4e32-923b-f74581371c2c'  -- Lipo-Mino Mix
);