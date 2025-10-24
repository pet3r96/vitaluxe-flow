-- Fix historical provider order #4f716ea9 to link to correct practice
-- This ensures the practice sees the order and reps get assigned correctly

UPDATE orders 
SET 
  doctor_id = '64b936b4-135f-425f-8b1d-8e54dc7cf63c', -- Test Practice D 1 profile_id
  updated_at = now()
WHERE id = '4f716ea9-06a2-4211-83da-8305d29ecc11'
  AND doctor_id = 'ddc85f7f-b03a-43d0-aec1-27215a1875a7'; -- Old provider user_id

-- Trigger profit recalculation by touching order_lines
-- This forces calculate_order_line_profit() trigger to run and assign topline/downline reps
UPDATE order_lines
SET updated_at = now()
WHERE order_id = '4f716ea9-06a2-4211-83da-8305d29ecc11';