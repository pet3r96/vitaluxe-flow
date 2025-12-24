-- ============================================
-- COMPREHENSIVE PRODUCT VARIANT PRICING FIX
-- Updates ALL product_variants to match Excel spreadsheet exactly
-- ============================================

-- TIRZEPATIDE VARIANTS (14 variants) - CRITICAL FIX
-- These were 74-238% overpriced
UPDATE product_variants pv
SET 
  base_price = CASE pv.dosage_label
    WHEN '2.5mg (0.5ml)' THEN 139.00
    WHEN '5mg (1ml)' THEN 159.00
    WHEN '7.5mg (1.5ml)' THEN 179.00
    WHEN '10mg (2ml)' THEN 199.00
    WHEN '12.5mg (2.5ml)' THEN 229.00
    WHEN '15mg (3ml)' THEN 259.00
    WHEN '2.5mg/0.5mL' THEN 139.00
    WHEN '5mg/1mL' THEN 159.00
    WHEN '7.5mg/1.5mL' THEN 179.00
    WHEN '10mg/2mL' THEN 199.00
    WHEN '12.5mg/2.5mL' THEN 229.00
    WHEN '15mg/3mL' THEN 259.00
    ELSE base_price
  END,
  topline_price = CASE pv.dosage_label
    WHEN '2.5mg (0.5ml)' THEN 194.60
    WHEN '5mg (1ml)' THEN 222.60
    WHEN '7.5mg (1.5ml)' THEN 250.60
    WHEN '10mg (2ml)' THEN 278.60
    WHEN '12.5mg (2.5ml)' THEN 320.60
    WHEN '15mg (3ml)' THEN 362.60
    WHEN '2.5mg/0.5mL' THEN 194.60
    WHEN '5mg/1mL' THEN 222.60
    WHEN '7.5mg/1.5mL' THEN 250.60
    WHEN '10mg/2mL' THEN 278.60
    WHEN '12.5mg/2.5mL' THEN 320.60
    WHEN '15mg/3mL' THEN 362.60
    ELSE topline_price
  END,
  downline_price = CASE pv.dosage_label
    WHEN '2.5mg (0.5ml)' THEN 236.67
    WHEN '5mg (1ml)' THEN 270.77
    WHEN '7.5mg (1.5ml)' THEN 304.87
    WHEN '10mg (2ml)' THEN 338.97
    WHEN '12.5mg (2.5ml)' THEN 390.08
    WHEN '15mg (3ml)' THEN 441.19
    WHEN '2.5mg/0.5mL' THEN 236.67
    WHEN '5mg/1mL' THEN 270.77
    WHEN '7.5mg/1.5mL' THEN 304.87
    WHEN '10mg/2mL' THEN 338.97
    WHEN '12.5mg/2.5mL' THEN 390.08
    WHEN '15mg/3mL' THEN 441.19
    ELSE downline_price
  END,
  retail_price = CASE pv.dosage_label
    WHEN '2.5mg (0.5ml)' THEN 264.93
    WHEN '5mg (1ml)' THEN 303.10
    WHEN '7.5mg (1.5ml)' THEN 341.26
    WHEN '10mg (2ml)' THEN 379.43
    WHEN '12.5mg (2.5ml)' THEN 436.69
    WHEN '15mg (3ml)' THEN 493.96
    WHEN '2.5mg/0.5mL' THEN 264.93
    WHEN '5mg/1mL' THEN 303.10
    WHEN '7.5mg/1.5mL' THEN 341.26
    WHEN '10mg/2mL' THEN 379.43
    WHEN '12.5mg/2.5mL' THEN 436.69
    WHEN '15mg/3mL' THEN 493.96
    ELSE retail_price
  END
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Tirzepatide%'
);

-- SEMAGLUTIDE RDT VARIANTS (4 variants) - CRITICAL FIX
-- These were 128-238% overpriced
UPDATE product_variants pv
SET 
  base_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5mg%' THEN 99.00
    WHEN pv.dosage_label ILIKE '%1mg%' THEN 119.00
    WHEN pv.dosage_label ILIKE '%2mg%' OR pv.dosage_label ILIKE '%2.4mg%' THEN 139.00
    ELSE base_price
  END,
  topline_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5mg%' THEN 138.60
    WHEN pv.dosage_label ILIKE '%1mg%' THEN 166.60
    WHEN pv.dosage_label ILIKE '%2mg%' OR pv.dosage_label ILIKE '%2.4mg%' THEN 194.60
    ELSE topline_price
  END,
  downline_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5mg%' THEN 168.60
    WHEN pv.dosage_label ILIKE '%1mg%' THEN 202.62
    WHEN pv.dosage_label ILIKE '%2mg%' OR pv.dosage_label ILIKE '%2.4mg%' THEN 236.67
    ELSE downline_price
  END,
  retail_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5mg%' THEN 188.69
    WHEN pv.dosage_label ILIKE '%1mg%' THEN 226.77
    WHEN pv.dosage_label ILIKE '%2mg%' OR pv.dosage_label ILIKE '%2.4mg%' THEN 264.93
    ELSE retail_price
  END
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Semaglutide RDT%'
);

-- SEMAGLUTIDE INJECTION VARIANTS - Standard pricing
UPDATE product_variants pv
SET 
  base_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5%' THEN 89.00
    WHEN pv.dosage_label ILIKE '%1mg%' OR pv.dosage_label ILIKE '%1.0%' THEN 109.00
    WHEN pv.dosage_label ILIKE '%1.7%' OR pv.dosage_label ILIKE '%2%' THEN 129.00
    WHEN pv.dosage_label ILIKE '%2.4%' THEN 149.00
    ELSE base_price
  END,
  topline_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5%' THEN 124.60
    WHEN pv.dosage_label ILIKE '%1mg%' OR pv.dosage_label ILIKE '%1.0%' THEN 152.60
    WHEN pv.dosage_label ILIKE '%1.7%' OR pv.dosage_label ILIKE '%2%' THEN 180.60
    WHEN pv.dosage_label ILIKE '%2.4%' THEN 208.60
    ELSE topline_price
  END,
  downline_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5%' THEN 151.57
    WHEN pv.dosage_label ILIKE '%1mg%' OR pv.dosage_label ILIKE '%1.0%' THEN 185.62
    WHEN pv.dosage_label ILIKE '%1.7%' OR pv.dosage_label ILIKE '%2%' THEN 219.68
    WHEN pv.dosage_label ILIKE '%2.4%' THEN 253.73
    ELSE downline_price
  END,
  retail_price = CASE 
    WHEN pv.dosage_label ILIKE '%0.25%' OR pv.dosage_label ILIKE '%0.5%' THEN 169.66
    WHEN pv.dosage_label ILIKE '%1mg%' OR pv.dosage_label ILIKE '%1.0%' THEN 207.77
    WHEN pv.dosage_label ILIKE '%1.7%' OR pv.dosage_label ILIKE '%2%' THEN 245.89
    WHEN pv.dosage_label ILIKE '%2.4%' THEN 284.00
    ELSE retail_price
  END
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Semaglutide%' AND p.name NOT ILIKE '%RDT%' AND p.name NOT ILIKE '%Sublingual%'
);

-- TESTOSTERONE CREAM VARIANTS (all versions)
UPDATE product_variants pv
SET 
  base_price = 19.71,
  topline_price = 27.60,
  downline_price = 33.60,
  retail_price = 37.60
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Testosterone Cream%'
);

-- TESTOSTERONE CYPIONATE VARIANTS
UPDATE product_variants pv
SET 
  base_price = CASE 
    WHEN pv.dosage_label ILIKE '%200mg%' THEN 17.77
    WHEN pv.dosage_label ILIKE '%100mg%' THEN 15.77
    ELSE 17.77
  END,
  topline_price = CASE 
    WHEN pv.dosage_label ILIKE '%200mg%' THEN 24.88
    WHEN pv.dosage_label ILIKE '%100mg%' THEN 22.08
    ELSE 24.88
  END,
  downline_price = CASE 
    WHEN pv.dosage_label ILIKE '%200mg%' THEN 30.26
    WHEN pv.dosage_label ILIKE '%100mg%' THEN 26.86
    ELSE 30.26
  END,
  retail_price = CASE 
    WHEN pv.dosage_label ILIKE '%200mg%' THEN 33.87
    WHEN pv.dosage_label ILIKE '%100mg%' THEN 30.07
    ELSE 33.87
  END
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Testosterone Cypionate%'
);

-- TESTOSTERONE ENANTHATE VARIANTS
UPDATE product_variants pv
SET 
  base_price = 19.14,
  topline_price = 26.80,
  downline_price = 32.61,
  retail_price = 36.50
WHERE pv.product_id IN (
  SELECT p.id FROM products p WHERE p.name ILIKE '%Testosterone Enanthate%'
);

-- Update ALL remaining VIOS product variants with formula-based pricing
-- base_price already correct, calculate tiers: topline = base * 1.4, downline = base * 1.7, retail = base * 1.905
UPDATE product_variants pv
SET 
  topline_price = ROUND((base_price * 1.40)::numeric, 2),
  downline_price = ROUND((base_price * 1.7037)::numeric, 2),
  retail_price = ROUND((base_price * 1.9063)::numeric, 2)
WHERE pv.product_id IN (
  SELECT p.id FROM products p 
  WHERE p.pharmacy_id = 'd5e75179-e66c-450f-8cae-1f4df93b097c'
)
AND (topline_price IS NULL OR downline_price IS NULL);