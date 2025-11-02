-- Drop the problematic recalculate function that's causing build errors
DROP FUNCTION IF EXISTS recalculate_order_profits_for_practice(UUID);