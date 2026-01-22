-- Create validation function for VIOS product assignment invariant
CREATE OR REPLACE FUNCTION validate_vios_product_assignment()
RETURNS TRIGGER AS $$
DECLARE
  vios_pharmacy_id UUID := 'd5e75179-e66c-450f-8cae-1f4df93b097c';
  product_vios_id TEXT;
  catalog_exists BOOLEAN;
  catalog_count INTEGER;
BEGIN
  -- Only check if assigning to VIOS
  IF NEW.pharmacy_id = vios_pharmacy_id THEN
    -- Get the product's VIOS ID
    SELECT vios_lf_product_id INTO product_vios_id
    FROM products WHERE id = NEW.product_id;
    
    -- Must have a VIOS product ID
    IF product_vios_id IS NULL OR product_vios_id = '' THEN
      RAISE EXCEPTION 'Invariant violation: Products assigned to VIOS Compounding must have a vios_lf_product_id set. Configure this in Product Management.';
    END IF;
    
    -- Check if catalog is populated before enforcing catalog existence
    SELECT COUNT(*) INTO catalog_count FROM vios_product_catalog LIMIT 1;
    
    -- Only enforce catalog check if catalog has been populated
    IF catalog_count > 0 THEN
      SELECT EXISTS(
        SELECT 1 FROM vios_product_catalog WHERE med_id = product_vios_id
      ) INTO catalog_exists;
      
      IF NOT catalog_exists THEN
        RAISE EXCEPTION 'Invariant violation: vios_lf_product_id "%" not found in VIOS catalog. Re-import catalog or select a valid product.', product_vios_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_vios_product_id ON product_pharmacies;

-- Create trigger to enforce VIOS product ID on assignment
CREATE TRIGGER enforce_vios_product_id
  BEFORE INSERT OR UPDATE ON product_pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION validate_vios_product_assignment();

-- Add comment explaining the trigger
COMMENT ON TRIGGER enforce_vios_product_id ON product_pharmacies IS 
  'Enforces invariant: Products assigned to VIOS Compounding must have a valid vios_lf_product_id linked to the VIOS catalog.';