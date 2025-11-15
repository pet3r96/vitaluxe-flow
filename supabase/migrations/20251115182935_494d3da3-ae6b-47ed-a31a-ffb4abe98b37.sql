-- ============================================
-- PHASE A: CRITICAL INTEGRITY FIXES
-- ============================================

-- 1. Add missing foreign key constraint between orders and order_lines
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_lines_order_id_fkey'
  ) THEN
    ALTER TABLE order_lines
    ADD CONSTRAINT order_lines_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Add composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_doctor_created_status 
ON orders(doctor_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_orders_status_created 
ON orders(status, created_at DESC) 
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_lines_order_status 
ON order_lines(order_id, status);

CREATE INDEX IF NOT EXISTS idx_order_lines_patient_created 
ON order_lines(patient_id, created_at DESC) 
WHERE patient_id IS NOT NULL;

-- 3. Consolidate overlapping RLS policies on orders table
-- Drop all existing SELECT policies first
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Doctors can view their own orders" ON orders;
DROP POLICY IF EXISTS "Doctors can view their practice orders" ON orders;
DROP POLICY IF EXISTS "Pharmacies can view assigned orders" ON orders;
DROP POLICY IF EXISTS "Providers can view their practice orders" ON orders;
DROP POLICY IF EXISTS "Providers view their practice orders" ON orders;
DROP POLICY IF EXISTS "Reps can view orders from their practices" ON orders;
DROP POLICY IF EXISTS "Staff can view practice orders" ON orders;
DROP POLICY IF EXISTS "Users can view orders based on role" ON orders;
DROP POLICY IF EXISTS "View orders based on role" ON orders;
DROP POLICY IF EXISTS "staff_view_practice_orders" ON orders;

-- Create consolidated, non-overlapping SELECT policies
CREATE POLICY "orders_select_admin"
ON orders FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "orders_select_practice_staff_provider"
ON orders FOR SELECT
USING (
  -- Practice owners
  (auth.uid() = doctor_id)
  OR
  -- Staff members
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.practice_id = orders.doctor_id
    AND ps.active = true
  )
  OR
  -- Providers
  EXISTS (
    SELECT 1 FROM providers p
    WHERE p.user_id = auth.uid()
    AND p.practice_id = orders.doctor_id
  )
);

CREATE POLICY "orders_select_pharmacy"
ON orders FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role)
  AND EXISTS (
    SELECT 1 FROM order_lines ol
    WHERE ol.order_id = orders.id
    AND ol.assigned_pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  )
);

-- 4. Fix cart_lines RLS inconsistency (UPDATE should also check expiration)
DROP POLICY IF EXISTS "Doctors can update their own cart lines" ON cart_lines;
DROP POLICY IF EXISTS "Users can update their own cart lines" ON cart_lines;

CREATE POLICY "cart_lines_update_owner"
ON cart_lines FOR UPDATE
USING (
  is_cart_owner(auth.uid(), cart_id)
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  is_cart_owner(auth.uid(), cart_id)
  AND (expires_at IS NULL OR expires_at > now())
);

DROP POLICY IF EXISTS "Staff update practice cart lines" ON cart_lines;

CREATE POLICY "cart_lines_update_staff"
ON cart_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
  AND (expires_at IS NULL OR expires_at > now())
);