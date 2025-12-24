-- Create a view to get product price ranges from variants
CREATE OR REPLACE VIEW public.product_variant_stats AS
SELECT 
  p.id as product_id,
  COUNT(pv.id)::int as variant_count,
  COALESCE(MIN(pv.retail_price), p.retail_price) as min_retail_price,
  COALESCE(MAX(pv.retail_price), p.retail_price) as max_retail_price,
  COALESCE(MIN(pv.topline_price), p.topline_price) as min_topline_price,
  COALESCE(MAX(pv.topline_price), p.topline_price) as max_topline_price,
  COALESCE(MIN(pv.downline_price), p.downline_price) as min_downline_price,
  COALESCE(MAX(pv.downline_price), p.downline_price) as max_downline_price,
  COALESCE(MIN(pv.base_price), p.base_price) as min_base_price,
  COALESCE(MAX(pv.base_price), p.base_price) as max_base_price
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
GROUP BY p.id;