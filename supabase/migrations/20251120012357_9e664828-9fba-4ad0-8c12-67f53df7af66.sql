-- Fix 1: Remove Broken Order Line Profit Trigger
-- Use CASCADE to drop dependent trigger first
DROP FUNCTION IF EXISTS calculate_order_line_profit() CASCADE;