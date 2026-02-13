
-- Add days_supply column to cart_lines
ALTER TABLE public.cart_lines ADD COLUMN days_supply INTEGER;

-- Add days_supply column to order_lines
ALTER TABLE public.order_lines ADD COLUMN days_supply INTEGER;
