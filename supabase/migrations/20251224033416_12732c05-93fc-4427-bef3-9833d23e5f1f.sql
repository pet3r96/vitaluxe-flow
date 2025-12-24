-- Step 1: Delete product_variants for duplicate products (keep first by created_at)
DELETE FROM product_variants 
WHERE product_id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at ASC) as rn
    FROM products
  ) sub WHERE rn > 1
);

-- Step 2: Delete product_pharmacies for duplicate products
DELETE FROM product_pharmacies 
WHERE product_id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at ASC) as rn
    FROM products
  ) sub WHERE rn > 1
);

-- Step 3: Delete the duplicate products themselves
DELETE FROM products 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at ASC) as rn
    FROM products
  ) sub WHERE rn > 1
);

-- Step 4: Add unique constraint on product name to prevent future duplicates
CREATE UNIQUE INDEX idx_products_unique_name ON products(LOWER(name));