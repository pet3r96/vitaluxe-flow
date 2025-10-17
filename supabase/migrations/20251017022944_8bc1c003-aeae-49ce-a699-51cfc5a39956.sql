-- Create product_types table
CREATE TABLE public.product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone authenticated can SELECT (for dropdowns), only admins can modify
CREATE POLICY "Anyone can view product types"
  ON public.product_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage product types"
  ON public.product_types
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed product_types from existing enum values
INSERT INTO public.product_types (name)
SELECT unnest(enum_range(NULL::product_type))::text;

-- Add new column to products
ALTER TABLE public.products ADD COLUMN product_type_id UUID;

-- Backfill product_type_id from product_type enum
UPDATE public.products p
SET product_type_id = pt.id
FROM public.product_types pt
WHERE p.product_type::text = pt.name;

-- Make product_type_id required
ALTER TABLE public.products ALTER COLUMN product_type_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE public.products 
ADD CONSTRAINT products_product_type_fk 
FOREIGN KEY (product_type_id) 
REFERENCES public.product_types(id) 
ON UPDATE CASCADE 
ON DELETE RESTRICT;

-- Drop old enum column and type
ALTER TABLE public.products DROP COLUMN product_type;
DROP TYPE public.product_type;