-- Phase 1: Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  dosage_label text NOT NULL,
  sku text,
  base_price numeric NOT NULL,
  topline_price numeric,
  downline_price numeric,
  retail_price numeric,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants(product_id, active);

-- Phase 2: Add variant_id to cart_lines (NULLABLE for backward compatibility)
ALTER TABLE cart_lines ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id);

-- Phase 3: Add variant_id to order_lines (NULLABLE for backward compatibility)
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id);

-- Phase 4: RLS Policies for product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- SELECT: Allow all authenticated users to view variants
CREATE POLICY "Authenticated users can view product variants"
ON product_variants
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Allow admins only (check user_roles table)
CREATE POLICY "Admins can insert product variants"
ON product_variants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- UPDATE: Allow admins only
CREATE POLICY "Admins can update product variants"
ON product_variants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- DELETE: Allow admins only
CREATE POLICY "Admins can delete product variants"
ON product_variants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Phase 5: Optional Backfill - Create default variant for existing products
INSERT INTO product_variants (product_id, dosage_label, base_price, topline_price, downline_price, retail_price, active)
SELECT 
  id, 
  COALESCE(dosage, 'Standard'), 
  COALESCE(base_price, 0), 
  topline_price, 
  downline_price, 
  retail_price,
  active
FROM products
WHERE NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = products.id);