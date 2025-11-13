-- Add RLS policy for staff users in providers table to insert order_lines
-- This allows staff members (stored in providers table with role_type starting with 'staff_')
-- who have can_order = true to insert order_lines for their practice's orders

CREATE POLICY "Staff in providers table can insert order lines for practice orders"
ON order_lines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM providers p
    INNER JOIN orders o ON o.doctor_id = p.practice_id
    WHERE p.user_id = auth.uid()
      AND p.role_type LIKE 'staff_%'
      AND p.can_order = true
      AND o.id = order_lines.order_id
  )
);