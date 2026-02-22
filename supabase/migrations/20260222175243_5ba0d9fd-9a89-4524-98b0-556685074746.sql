
ALTER TABLE public.cart_lines ADD COLUMN IF NOT EXISTS ship_to TEXT DEFAULT 'patient';

UPDATE public.cart_lines SET ship_to = 'practice' WHERE patient_name = 'Practice Order';
