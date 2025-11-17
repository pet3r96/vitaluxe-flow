-------------------------------------------------------
-- PHASE 5B — PERFORMANCE INDEXES + RATE LIMITING
-- Safe, additive improvements for production load
-------------------------------------------------------

-----------------------------
-- 1️⃣ PERFORMANCE INDEXES
-----------------------------

-- PATIENT MESSAGES (queue views, threading)
CREATE INDEX IF NOT EXISTS idx_patient_messages_practice_resolved_created
ON patient_messages (practice_id, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_messages_thread_created
ON patient_messages (parent_message_id, created_at DESC) WHERE parent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_messages_patient_created
ON patient_messages (patient_id, created_at DESC);

-- MEDICAL VAULT (fast per-patient loads)
CREATE INDEX IF NOT EXISTS idx_vault_patient_type_created
ON patient_medical_vault (patient_account_id, record_type, created_at DESC);

-- ORDERS / ORDER LINES (dashboards & pharmacy views)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
ON orders (status, created_at DESC) WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_status_created
ON order_lines (assigned_pharmacy_id, status, created_at DESC);

-- CART (active cart refresh)
CREATE INDEX IF NOT EXISTS idx_cart_doctor_created
ON cart (doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cart_lines_cart_expires
ON cart_lines (cart_id, expires_at);

-----------------------------
-- 2️⃣ RATE LIMIT TABLE
-----------------------------

-- Centralized per-user function call ledger
CREATE TABLE IF NOT EXISTS function_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE function_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS: user writes/reads only their own rows
DROP POLICY IF EXISTS "frl_user_access" ON function_rate_limits;
CREATE POLICY "frl_user_access" ON function_rate_limits
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS: admins see all
DROP POLICY IF EXISTS "frl_admin_all" ON function_rate_limits;
CREATE POLICY "frl_admin_all" ON function_rate_limits
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for windowed counts
CREATE INDEX IF NOT EXISTS idx_frl_function_user_created
ON function_rate_limits (function_name, user_id, created_at DESC);