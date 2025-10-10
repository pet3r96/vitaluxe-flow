-- Create new enum type with only allowed carriers
CREATE TYPE shipping_carrier_new AS ENUM ('fedex', 'ups', 'usps');

-- Update any existing 'dhl' or 'other' values to 'fedex'
UPDATE order_lines 
SET shipping_carrier = 'fedex' 
WHERE shipping_carrier IN ('dhl', 'other');

UPDATE shipping_audit_logs 
SET old_carrier = 'fedex' 
WHERE old_carrier IN ('dhl', 'other');

UPDATE shipping_audit_logs 
SET new_carrier = 'fedex' 
WHERE new_carrier IN ('dhl', 'other');

-- Drop default before altering type
ALTER TABLE order_lines 
  ALTER COLUMN shipping_carrier DROP DEFAULT;

-- Alter columns to use the new enum type
ALTER TABLE order_lines 
  ALTER COLUMN shipping_carrier TYPE shipping_carrier_new 
  USING shipping_carrier::text::shipping_carrier_new;

ALTER TABLE shipping_audit_logs 
  ALTER COLUMN old_carrier TYPE shipping_carrier_new 
  USING old_carrier::text::shipping_carrier_new;

ALTER TABLE shipping_audit_logs 
  ALTER COLUMN new_carrier TYPE shipping_carrier_new 
  USING new_carrier::text::shipping_carrier_new;

-- Drop the old enum and rename the new one
DROP TYPE shipping_carrier;
ALTER TYPE shipping_carrier_new RENAME TO shipping_carrier;

-- Restore the default value with the new enum
ALTER TABLE order_lines 
  ALTER COLUMN shipping_carrier SET DEFAULT 'fedex'::shipping_carrier;