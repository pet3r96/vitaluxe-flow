-- ============================================
-- CRITICAL FIX: Per-User Cart Isolation
-- Remove shared practice cart policies
-- Enforce strict per-user cart boundaries
-- ============================================

-- Step 1: Drop old staff practice cart policies
DROP POLICY IF EXISTS "Staff manage practice cart" ON cart;
DROP POLICY IF EXISTS "Staff view practice cart lines" ON cart_lines;
DROP POLICY IF EXISTS "Staff insert practice cart lines" ON cart_lines;
DROP POLICY IF EXISTS "Staff delete practice cart lines" ON cart_lines;
DROP POLICY IF EXISTS "cart_lines_update_staff" ON cart_lines;

-- Step 2: Create new per-user cart policies for staff
-- Staff can only manage their OWN cart (not practice cart)
CREATE POLICY "Staff manage own cart"
ON cart
FOR ALL
TO authenticated
USING (auth.uid() = doctor_id);

CREATE POLICY "Staff view own cart lines"
ON cart_lines
FOR SELECT
TO public
USING (
  is_cart_owner(auth.uid(), cart_id) 
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE POLICY "Staff insert own cart lines"
ON cart_lines
FOR INSERT
TO authenticated
WITH CHECK (is_cart_owner(auth.uid(), cart_id));

CREATE POLICY "Staff delete own cart lines"
ON cart_lines
FOR DELETE
TO authenticated
USING (is_cart_owner(auth.uid(), cart_id));

CREATE POLICY "Staff update own cart lines"
ON cart_lines
FOR UPDATE
TO public
USING (
  is_cart_owner(auth.uid(), cart_id) 
  AND (expires_at IS NULL OR expires_at > now())
)
WITH CHECK (
  is_cart_owner(auth.uid(), cart_id) 
  AND (expires_at IS NULL OR expires_at > now())
);