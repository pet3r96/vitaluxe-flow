-- Create helper function for pharmacy staff access check
CREATE OR REPLACE FUNCTION public.pharmacy_staff_access(pharmacy_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pharmacy_staff
    WHERE pharmacy_id = pharmacy_uuid
      AND user_id = auth.uid()
      AND active = true
  )
$$;

-- Update orders policies to include pharmacy staff
DROP POLICY IF EXISTS "pharmacy_view_orders" ON orders;
CREATE POLICY "pharmacy_view_orders" ON orders FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = orders.id 
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

DROP POLICY IF EXISTS "pharmacy_update_orders" ON orders;
CREATE POLICY "pharmacy_update_orders" ON orders FOR UPDATE
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = orders.id 
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update order_lines policies
DROP POLICY IF EXISTS "pharmacy_view_lines" ON order_lines;
CREATE POLICY "pharmacy_view_lines" ON order_lines FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = order_lines.assigned_pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

DROP POLICY IF EXISTS "pharmacy_update_lines" ON order_lines;
CREATE POLICY "pharmacy_update_lines" ON order_lines FOR UPDATE
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = order_lines.assigned_pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update order_status_history policy
DROP POLICY IF EXISTS "Pharmacies can view assigned order status history" ON order_status_history;
CREATE POLICY "Pharmacies can view assigned order status history" ON order_status_history FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.order_id = order_status_history.order_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update pharmacy_order_jobs policies
DROP POLICY IF EXISTS "pharmacy_jobs_select_assigned" ON pharmacy_order_jobs;
CREATE POLICY "pharmacy_jobs_select_assigned" ON pharmacy_order_jobs FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_order_jobs.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

DROP POLICY IF EXISTS "pharmacy_jobs_update_assigned" ON pharmacy_order_jobs;
CREATE POLICY "pharmacy_jobs_update_assigned" ON pharmacy_order_jobs FOR UPDATE
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_order_jobs.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update pharmacy_order_transmissions policy
DROP POLICY IF EXISTS "Pharmacies can view their own transmissions" ON pharmacy_order_transmissions;
CREATE POLICY "Pharmacies can view their own transmissions" ON pharmacy_order_transmissions FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_order_transmissions.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update pharmacy_shipping_rates policy
DROP POLICY IF EXISTS "Pharmacies manage their shipping rates" ON pharmacy_shipping_rates;
CREATE POLICY "Pharmacies manage their shipping rates" ON pharmacy_shipping_rates FOR ALL
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_shipping_rates.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_shipping_rates.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update pharmacy_tracking_updates policy
DROP POLICY IF EXISTS "Pharmacies can view their own tracking updates" ON pharmacy_tracking_updates;
CREATE POLICY "Pharmacies can view their own tracking updates" ON pharmacy_tracking_updates FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM order_lines ol
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE ol.id = pharmacy_tracking_updates.order_line_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update support_tickets pharmacy policies (uses created_by, not user_id)
DROP POLICY IF EXISTS "Pharmacies can view/update their support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Pharmacies can view their support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Pharmacies can update their support tickets" ON support_tickets;

CREATE POLICY "Pharmacies can view their support tickets" ON support_tickets FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = support_tickets.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

CREATE POLICY "Pharmacies can update their support tickets" ON support_tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = support_tickets.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);

-- Update support_ticket_replies policy (uses created_by for ticket ownership)
DROP POLICY IF EXISTS "Users can view replies to accessible tickets" ON support_ticket_replies;
CREATE POLICY "Users can view replies to accessible tickets" ON support_ticket_replies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM support_tickets st
    WHERE st.id = support_ticket_replies.ticket_id
    AND (
      st.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = st.practice_id AND p.id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM practice_staff ps 
        WHERE ps.practice_id = st.practice_id 
        AND ps.user_id = auth.uid() 
        AND ps.active = true
      )
      OR EXISTS (
        SELECT 1 FROM pharmacies ph 
        WHERE ph.id = st.pharmacy_id 
        AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
      )
    )
  )
);

-- Update pharmacy_idempotency_keys policy
DROP POLICY IF EXISTS "Pharmacies can manage idempotency keys" ON pharmacy_idempotency_keys;
DROP POLICY IF EXISTS "Admins can view idempotency keys" ON pharmacy_idempotency_keys;

CREATE POLICY "Pharmacies can manage idempotency keys" ON pharmacy_idempotency_keys FOR ALL
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_idempotency_keys.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'pharmacy'::app_role) AND (
    EXISTS (
      SELECT 1 FROM pharmacies ph
      WHERE ph.id = pharmacy_idempotency_keys.pharmacy_id
      AND (ph.user_id = auth.uid() OR pharmacy_staff_access(ph.id))
    )
  )
);