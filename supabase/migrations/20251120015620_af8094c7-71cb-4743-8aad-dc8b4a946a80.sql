-- Fix RLS policies for messaging system

-- 1. Fix orders table RLS - Allow practice staff/providers to read orders for their practice
DROP POLICY IF EXISTS "allow_practice_staff_view_orders" ON orders;
CREATE POLICY "allow_practice_staff_view_orders" ON orders
  FOR SELECT
  USING (
    -- Practice owners can see their own orders
    doctor_id = auth.uid()
    OR
    -- Staff can see their practice's orders
    EXISTS (
      SELECT 1 FROM practice_staff
      WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = orders.doctor_id
      AND practice_staff.active = true
    )
    OR
    -- Providers can see their practice's orders
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.user_id = auth.uid()
      AND providers.practice_id = orders.doctor_id
      AND providers.active = true
    )
  );

-- 2. Fix support_tickets RLS - Allow proper insert permissions
DROP POLICY IF EXISTS "allow_authenticated_insert_tickets" ON support_tickets;
CREATE POLICY "allow_authenticated_insert_tickets" ON support_tickets
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
  );

-- 3. Fix patient_messages RLS - Allow practice users to send messages
DROP POLICY IF EXISTS "allow_practice_send_patient_messages" ON patient_messages;
CREATE POLICY "allow_practice_send_patient_messages" ON patient_messages
  FOR INSERT
  WITH CHECK (
    -- Allow if sender is practice owner
    practice_id = auth.uid()
    OR
    -- Allow if sender is staff of the practice
    EXISTS (
      SELECT 1 FROM practice_staff
      WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = patient_messages.practice_id
      AND practice_staff.active = true
    )
    OR
    -- Allow if sender is provider of the practice
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.user_id = auth.uid()
      AND providers.practice_id = patient_messages.practice_id
      AND providers.active = true
    )
  );

-- 4. Ensure patient_messages SELECT policy exists
DROP POLICY IF EXISTS "allow_practice_view_patient_messages" ON patient_messages;
CREATE POLICY "allow_practice_view_patient_messages" ON patient_messages
  FOR SELECT
  USING (
    -- Practice owner can view
    practice_id = auth.uid()
    OR
    -- Staff can view
    EXISTS (
      SELECT 1 FROM practice_staff
      WHERE practice_staff.user_id = auth.uid()
      AND practice_staff.practice_id = patient_messages.practice_id
      AND practice_staff.active = true
    )
    OR
    -- Providers can view
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.user_id = auth.uid()
      AND providers.practice_id = patient_messages.practice_id
      AND providers.active = true
    )
    OR
    -- Patients can view their own messages
    patient_id IN (
      SELECT id FROM patient_accounts
      WHERE user_id = auth.uid()
    )
  );