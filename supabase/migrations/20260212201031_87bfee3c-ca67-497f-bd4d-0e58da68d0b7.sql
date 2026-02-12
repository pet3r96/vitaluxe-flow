
-- Allow order_lines.product_id to be NULL and SET NULL on product delete
ALTER TABLE order_lines ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_product_id_fkey;
ALTER TABLE order_lines ADD CONSTRAINT order_lines_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Allow order_lines.variant_id to SET NULL on variant delete
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_variant_id_fkey;
ALTER TABLE order_lines ADD CONSTRAINT order_lines_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- cart_lines: SET NULL on product/variant delete
ALTER TABLE cart_lines DROP CONSTRAINT IF EXISTS cart_lines_product_id_fkey;
ALTER TABLE cart_lines ADD CONSTRAINT cart_lines_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE cart_lines DROP CONSTRAINT IF EXISTS cart_lines_variant_id_fkey;
ALTER TABLE cart_lines ADD CONSTRAINT cart_lines_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- amazon_tracking_api_calls: SET NULL on order_line delete (if needed)
ALTER TABLE amazon_tracking_api_calls DROP CONSTRAINT IF EXISTS amazon_tracking_api_calls_order_line_id_fkey;
ALTER TABLE amazon_tracking_api_calls ADD CONSTRAINT amazon_tracking_api_calls_order_line_id_fkey
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE SET NULL;
