-- Allow downline reps to view orders for their assigned practices
CREATE POLICY "Downlines can view assigned practice orders"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND doctor_id IN (
    SELECT rpl.practice_id
    FROM rep_practice_links rpl
    JOIN reps r ON rpl.rep_id = r.id
    WHERE r.user_id = auth.uid()
  )
);

-- Allow topline reps to view orders for their downlines' practices
CREATE POLICY "Toplines can view downline practice orders"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'topline'::app_role)
  AND doctor_id IN (
    SELECT rpl.practice_id
    FROM rep_practice_links rpl
    JOIN reps r ON rpl.assigned_topline_id = r.id
    WHERE r.user_id = auth.uid()
  )
);

-- Allow downline reps to view order lines for their practices
CREATE POLICY "Downlines can view order lines for their practices"
ON public.order_lines
FOR SELECT
USING (
  has_role(auth.uid(), 'downline'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    JOIN rep_practice_links rpl ON o.doctor_id = rpl.practice_id
    JOIN reps r ON rpl.rep_id = r.id
    WHERE o.id = order_lines.order_id
      AND r.user_id = auth.uid()
  )
);

-- Allow topline reps to view order lines for downline practices
CREATE POLICY "Toplines can view order lines for downline practices"
ON public.order_lines
FOR SELECT
USING (
  has_role(auth.uid(), 'topline'::app_role)
  AND EXISTS (
    SELECT 1
    FROM orders o
    JOIN rep_practice_links rpl ON o.doctor_id = rpl.practice_id
    JOIN reps r ON rpl.assigned_topline_id = r.id
    WHERE o.id = order_lines.order_id
      AND r.user_id = auth.uid()
  )
);

-- Allow reps to view profiles (doctor names) of assigned practices
CREATE POLICY "Reps can view profiles of assigned practices"
ON public.profiles
FOR SELECT
USING (
  (
    has_role(auth.uid(), 'downline'::app_role) AND
    id IN (
      SELECT rpl.practice_id
      FROM rep_practice_links rpl
      JOIN reps r ON rpl.rep_id = r.id
      WHERE r.user_id = auth.uid()
    )
  )
  OR
  (
    has_role(auth.uid(), 'topline'::app_role) AND
    id IN (
      SELECT rpl.practice_id
      FROM rep_practice_links rpl
      JOIN reps r ON rpl.assigned_topline_id = r.id
      WHERE r.user_id = auth.uid()
    )
  )
);