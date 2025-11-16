-- ========================================
-- PHASE 3: Add Foreign Keys (Idempotent) - Retry
-- ========================================

-- 1. patient_appointments.room_id → practice_rooms(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'patient_appointments_room_id_fkey'
  ) THEN
    ALTER TABLE patient_appointments
      ADD CONSTRAINT patient_appointments_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES practice_rooms(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_patient_appointments_room_id 
  ON patient_appointments(room_id);

-- 2. amazon_tracking_api_calls.order_line_id → order_lines(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'amazon_tracking_api_calls_order_line_id_fkey'
  ) THEN
    ALTER TABLE amazon_tracking_api_calls
      ADD CONSTRAINT amazon_tracking_api_calls_order_line_id_fkey
      FOREIGN KEY (order_line_id) REFERENCES order_lines(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. rep_subscription_commissions.rep_id → profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rep_subscription_commissions_rep_id_fkey'
  ) THEN
    ALTER TABLE rep_subscription_commissions
      ADD CONSTRAINT rep_subscription_commissions_rep_id_fkey
      FOREIGN KEY (rep_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_rep_id 
  ON rep_subscription_commissions(rep_id);

-- 4. rep_subscription_commissions.subscription_id → practice_subscriptions(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rep_subscription_commissions_subscription_id_fkey'
  ) THEN
    ALTER TABLE rep_subscription_commissions
      ADD CONSTRAINT rep_subscription_commissions_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES practice_subscriptions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rep_subscription_commissions_subscription_id 
  ON rep_subscription_commissions(subscription_id);