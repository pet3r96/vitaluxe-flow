-- Add refill columns to cart_lines table
ALTER TABLE cart_lines 
ADD COLUMN IF NOT EXISTS refills_allowed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refills_total integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS refills_remaining integer DEFAULT 0;