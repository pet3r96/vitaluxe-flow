-- Add enabled column to pharmacy_shipping_rates to allow admins to enable/disable shipping options
ALTER TABLE pharmacy_shipping_rates 
  ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN pharmacy_shipping_rates.enabled IS 
  'Whether this shipping option is available for the pharmacy. If false, option will not be shown at checkout.';

-- Backfill existing rows to be enabled (backwards compatibility)
UPDATE pharmacy_shipping_rates SET enabled = true WHERE enabled IS NULL;