-- Drop and recreate product_variant_stats view to include first_variant_dosage
DROP VIEW IF EXISTS public.product_variant_stats;

CREATE VIEW public.product_variant_stats AS
SELECT 
  p.id AS product_id,
  COUNT(pv.id)::integer AS variant_count,
  MIN(pv.retail_price) AS min_retail_price,
  MAX(pv.retail_price) AS max_retail_price,
  MIN(pv.topline_price) AS min_topline_price,
  MAX(pv.topline_price) AS max_topline_price,
  MIN(pv.downline_price) AS min_downline_price,
  MAX(pv.downline_price) AS max_downline_price,
  MIN(pv.base_price) AS min_base_price,
  MAX(pv.base_price) AS max_base_price,
  (
    SELECT pv2.dosage_label 
    FROM public.product_variants pv2 
    WHERE pv2.product_id = p.id AND pv2.active = true 
    ORDER BY pv2.sort_order ASC, pv2.created_at ASC 
    LIMIT 1
  ) AS first_variant_dosage
FROM public.products p
LEFT JOIN public.product_variants pv ON p.id = pv.product_id AND pv.active = true
GROUP BY p.id;