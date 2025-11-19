-- Add admin_profit column to order_profits table
ALTER TABLE order_profits
ADD COLUMN IF NOT EXISTS admin_profit numeric(10, 2) DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_order_profits_admin_profit ON order_profits(admin_profit);

-- Backfill admin_profit for existing records
UPDATE order_profits
SET admin_profit = order_total - COALESCE(topline_profit, 0) - COALESCE(downline_profit, 0)
WHERE admin_profit = 0 OR admin_profit IS NULL;