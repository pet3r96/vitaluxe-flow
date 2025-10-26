-- Phase 1 & 2: Enforce Rx pricing rules and add tracking
-- Trigger to enforce Rx pricing rules at database level
CREATE OR REPLACE FUNCTION enforce_rx_pricing() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requires_prescription = true THEN
    -- Clear rep prices
    NEW.topline_price := NULL;
    NEW.downline_price := NULL;
    -- Force practice price = base price
    NEW.retail_price := NEW.base_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_rx_pricing
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION enforce_rx_pricing();

-- Add Rx flag to order_profits for efficient filtering
ALTER TABLE order_profits 
ADD COLUMN IF NOT EXISTS is_rx_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rx_restriction_note TEXT;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_order_profits_rx_required ON order_profits(is_rx_required);

-- Backfill existing data
UPDATE order_profits op
SET 
  is_rx_required = COALESCE(p.requires_prescription, false),
  rx_restriction_note = CASE 
    WHEN COALESCE(p.requires_prescription, false) = true 
    THEN 'Prescription-required: No rep commissions per federal anti-kickback regulations'
    ELSE NULL
  END
FROM order_lines ol
JOIN products p ON ol.product_id = p.id
WHERE op.order_line_id = ol.id;

-- Ensure Rx products have zero rep profits (compliance cleanup)
UPDATE order_profits op
SET 
  topline_profit = 0,
  downline_profit = 0
FROM order_lines ol
JOIN products p ON ol.product_id = p.id
WHERE op.order_line_id = ol.id
  AND p.requires_prescription = true
  AND (op.topline_profit != 0 OR op.downline_profit != 0);