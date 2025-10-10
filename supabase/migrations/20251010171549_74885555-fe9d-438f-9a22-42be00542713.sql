-- Create product_pharmacies junction table for many-to-many relationship
CREATE TABLE product_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, pharmacy_id)
);

-- Enable RLS on product_pharmacies
ALTER TABLE product_pharmacies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_pharmacies
CREATE POLICY "Admins can manage product pharmacies"
  ON product_pharmacies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view product pharmacies"
  ON product_pharmacies FOR SELECT
  USING (true);

-- Migrate existing product-pharmacy assignments to junction table
INSERT INTO product_pharmacies (product_id, pharmacy_id)
SELECT id, pharmacy_id 
FROM products 
WHERE pharmacy_id IS NOT NULL;

-- Create index for better query performance
CREATE INDEX idx_product_pharmacies_product_id ON product_pharmacies(product_id);
CREATE INDEX idx_product_pharmacies_pharmacy_id ON product_pharmacies(pharmacy_id);