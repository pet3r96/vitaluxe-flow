-- Create VIOS Product Catalog reference table
CREATE TABLE public.vios_product_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  med_id TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  form TEXT,
  strength TEXT,
  units TEXT,
  package TEXT,
  schedule TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vios_product_catalog ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read the catalog
CREATE POLICY "Allow read access to vios_product_catalog"
ON public.vios_product_catalog
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify the catalog
CREATE POLICY "Allow admin insert on vios_product_catalog"
ON public.vios_product_catalog
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Allow admin update on vios_product_catalog"
ON public.vios_product_catalog
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Allow admin delete on vios_product_catalog"
ON public.vios_product_catalog
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create indexes for fast lookups
CREATE INDEX idx_vios_catalog_med_id ON public.vios_product_catalog(med_id);
CREATE INDEX idx_vios_catalog_name ON public.vios_product_catalog USING gin(to_tsvector('english', product_name));
CREATE INDEX idx_vios_catalog_name_pattern ON public.vios_product_catalog(product_name text_pattern_ops);