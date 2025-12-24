-- Add missing product types for Vios Compounding catalog
INSERT INTO public.product_types (name, active)
VALUES 
  ('Hormone Therapy', true),
  ('Thyroid', true),
  ('Sexual Health', true),
  ('Hair Care', true),
  ('Anti-Aging', true)
ON CONFLICT (name) DO NOTHING;