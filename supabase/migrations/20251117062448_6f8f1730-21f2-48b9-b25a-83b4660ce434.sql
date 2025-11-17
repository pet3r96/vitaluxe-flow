-- Fix infinite recursion between orders and order_lines policies
-- 1) Drop recursive policies on order_lines that reference orders
DROP POLICY IF EXISTS "practice_view_lines" ON order_lines;
DROP POLICY IF EXISTS "practice_insert_lines" ON order_lines;

-- 2) Recreate non-recursive policies for practice users using providers/practice_staff only
CREATE POLICY "practice_view_lines"
ON order_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM providers pr
    WHERE pr.id = order_lines.provider_id
      AND (
        pr.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM practice_staff ps
          WHERE ps.practice_id = pr.practice_id
            AND ps.user_id = auth.uid()
            AND ps.active = true
        )
      )
  )
);

CREATE POLICY "practice_insert_lines"
ON order_lines
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM providers pr
    JOIN practice_staff ps ON ps.practice_id = pr.practice_id
    WHERE pr.id = order_lines.provider_id
      AND ps.user_id = auth.uid()
      AND ps.active = true
      AND ps.can_order = true
  )
);
