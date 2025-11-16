-- ========================================
-- Migration Plan: Add Missing Columns & Fix Foreign Keys
-- Date: 2025-11-16
-- Status: DRAFT - DO NOT EXECUTE WITHOUT APPROVAL
-- ========================================

-- ----------------------------------------
-- A. Add columns to existing tables
-- ----------------------------------------

-- 1. practice_rooms: Add missing display/config columns
ALTER TABLE practice_rooms 
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS color TEXT NULL,
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN practice_rooms.description IS 'Optional room description';
COMMENT ON COLUMN practice_rooms.color IS 'Hex color code for calendar display (e.g., #3B82F6)';
COMMENT ON COLUMN practice_rooms.capacity IS 'Maximum number of concurrent appointments';
COMMENT ON COLUMN practice_rooms.active IS 'Whether room is available for scheduling';

-- 2. amazon_tracking_api_calls: Link to order lines
ALTER TABLE amazon_tracking_api_calls
  ADD COLUMN IF NOT EXISTS order_line_id UUID NULL
    REFERENCES order_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_amazon_tracking_order_line 
  ON amazon_tracking_api_calls(order_line_id);

COMMENT ON COLUMN amazon_tracking_api_calls.order_line_id IS 'Links tracking API call to specific order line';

-- 3. practice_subscriptions: rep_commission_percentage already exists in schema
--    (Confirmed in types.ts line 2756 - no action needed)

-- ----------------------------------------
-- B. Fix Foreign Keys on rep_subscription_commissions
-- ----------------------------------------

-- Issue: Code uses incorrect relation syntax
-- Query: profiles!practice_id(...) should be profiles!rep_id(...)
-- Query: practice_subscriptions!subscription_id(...) is correct

-- Verify column names in rep_subscription_commissions:
-- - rep_id (references profiles or reps?)
-- - subscription_id (references practice_subscriptions)
-- - practice_subscription_id (also exists - duplicate?)

-- Add FK for rep_id to profiles (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rep_subscription_commissions_rep_id_fkey'
    AND table_name = 'rep_subscription_commissions'
  ) THEN
    ALTER TABLE rep_subscription_commissions
      ADD CONSTRAINT rep_subscription_commissions_rep_id_fkey
      FOREIGN KEY (rep_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK for subscription_id to practice_subscriptions (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'rep_subscription_commissions_subscription_id_fkey'
    AND table_name = 'rep_subscription_commissions'
  ) THEN
    ALTER TABLE rep_subscription_commissions
      ADD CONSTRAINT rep_subscription_commissions_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES practice_subscriptions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_rep_id 
  ON rep_subscription_commissions(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_subscription_id 
  ON rep_subscription_commissions(subscription_id);

-- ----------------------------------------
-- Notes & Warnings
-- ----------------------------------------

-- WARNING: The code query syntax is incorrect:
-- Current:  profiles!practice_id(...)
-- Should be: profiles!rep_id(...)
-- This migration adds the FK, but the TypeScript code ALSO needs fixing.
-- File: src/components/admin/SubscriptionCommissionManager.tsx line 53

-- Practice_subscriptions.rep_commission_percentage already exists (no migration needed)
