-------------------------------------------------------
-- PHASE 4 – POLICY CONSOLIDATION / CLEANUP BATCH 1
-------------------------------------------------------

-- 1️⃣ ORDERS TABLE – Simplify to 6 policies
DROP POLICY IF EXISTS "Doctors can view their orders" ON orders;
DROP POLICY IF EXISTS "Practice owners view their orders" ON orders;
DROP POLICY IF EXISTS "Topline view orders" ON orders;
DROP POLICY IF EXISTS "Pharmacy view orders" ON orders;
DROP POLICY IF EXISTS "Pharmacy update orders" ON orders;
DROP POLICY IF EXISTS "Admins manage orders" ON orders;

CREATE POLICY "admin_all_orders" ON orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "practice_view_orders" ON orders FOR SELECT
  USING (
    doctor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM practice_staff ps
      WHERE ps.practice_id = orders.doctor_id
      AND ps.user_id = auth.uid()
      AND ps.active = true
    )
  );

CREATE POLICY "practice_insert_orders" ON orders FOR INSERT
  WITH CHECK (
    doctor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM practice_staff ps
      WHERE ps.practice_id = orders.doctor_id
      AND ps.user_id = auth.uid()
      AND ps.active = true
      AND ps.can_order = true
    )
  );

CREATE POLICY "topline_view_orders" ON orders FOR SELECT
  USING (
    has_role(auth.uid(), 'topline'::app_role)
    AND doctor_id IN (
      SELECT p.id FROM profiles p
      WHERE p.linked_topline_id = auth.uid()
      AND p.active = true
    )
  );

CREATE POLICY "pharmacy_view_orders" ON orders FOR SELECT
  USING (
    has_role(auth.uid(), 'pharmacy'::app_role)
    AND EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = orders.id
      AND ph.user_id = auth.uid()
    )
  );

CREATE POLICY "pharmacy_update_orders" ON orders FOR UPDATE
  USING (
    has_role(auth.uid(), 'pharmacy'::app_role)
    AND EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = orders.id
      AND ph.user_id = auth.uid()
    )
  );


-- 2️⃣ ORDER_LINES TABLE – Simplify to 5 policies
DROP POLICY IF EXISTS "practice_view_lines" ON order_lines;
DROP POLICY IF EXISTS "pharmacy_update_lines" ON order_lines;
DROP POLICY IF EXISTS "topline_view_lines" ON order_lines;
DROP POLICY IF EXISTS "admin_manage_lines" ON order_lines;

CREATE POLICY "admin_all_lines" ON order_lines FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "practice_view_lines" ON order_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
      AND (
        o.doctor_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM practice_staff ps
          WHERE ps.practice_id = o.doctor_id
          AND ps.user_id = auth.uid()
          AND ps.active = true
        )
      )
    )
  );

CREATE POLICY "practice_insert_lines" ON order_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_lines.order_id
      AND EXISTS (
        SELECT 1 FROM practice_staff ps
        WHERE ps.practice_id = o.doctor_id
        AND ps.user_id = auth.uid()
        AND ps.active = true
        AND ps.can_order = true
      )
    )
  );

CREATE POLICY "pharmacy_view_lines" ON order_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = order_lines.assigned_pharmacy_id
      AND ph.user_id = auth.uid()
    )
  );

CREATE POLICY "pharmacy_update_lines" ON order_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = order_lines.assigned_pharmacy_id
      AND ph.user_id = auth.uid()
    )
  );