-- Fix 1: Allow staff to view message threads for their practice
CREATE POLICY "Staff view practice message threads"
ON public.message_threads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.active = true
    AND ps.practice_id = (
      CASE
        WHEN message_threads.created_by IS NOT NULL THEN
          (SELECT practice_id FROM profiles WHERE id = message_threads.created_by)
        WHEN message_threads.order_id IS NOT NULL THEN
          (SELECT doctor_id FROM orders WHERE id = message_threads.order_id)
        ELSE NULL
      END
    )
  )
);

-- Fix 2: Staff can manage practice cart (comprehensive access)
CREATE POLICY "Staff manage practice cart" ON public.cart FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.active = true
    AND ps.practice_id = cart.doctor_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    WHERE ps.user_id = auth.uid()
    AND ps.active = true
    AND ps.practice_id = cart.doctor_id
  )
);

-- Fix 3: Staff can view non-expired cart lines for practice
CREATE POLICY "Staff view practice cart lines" ON public.cart_lines FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
  AND (expires_at IS NULL OR expires_at > now())
);

-- Fix 4: Staff can insert cart lines for practice
CREATE POLICY "Staff insert practice cart lines" ON public.cart_lines FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- Fix 5: Staff can update cart lines for practice
CREATE POLICY "Staff update practice cart lines" ON public.cart_lines FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);

-- Fix 6: Staff can delete cart lines for practice
CREATE POLICY "Staff delete practice cart lines" ON public.cart_lines FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM cart c
    JOIN practice_staff ps ON ps.practice_id = c.doctor_id
    WHERE c.id = cart_lines.cart_id
    AND ps.user_id = auth.uid()
    AND ps.active = true
  )
);