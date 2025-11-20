-- Phase 1: Add Admin Bypass to RLS Policies for Impersonation
-- This allows admins to view/edit data while impersonating other users

-- 1. Update orders table RLS policy to allow admin access
DROP POLICY IF EXISTS "allow_practice_staff_view_orders" ON orders;
CREATE POLICY "allow_practice_staff_view_orders" ON orders FOR SELECT
USING (
  doctor_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admin bypass for impersonation
  OR EXISTS (SELECT 1 FROM practice_staff WHERE user_id = auth.uid() AND practice_id = doctor_id AND active = true)
  OR EXISTS (SELECT 1 FROM providers WHERE user_id = auth.uid() AND practice_id = doctor_id AND active = true)
);

-- 2. Update support_tickets RLS policies to allow admin access
DROP POLICY IF EXISTS "allow_practice_view_support_tickets" ON support_tickets;
CREATE POLICY "allow_practice_view_support_tickets" ON support_tickets FOR SELECT
USING (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admin bypass for impersonation
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "allow_admin_manage_all_tickets" ON support_tickets;
CREATE POLICY "allow_admin_manage_all_tickets" ON support_tickets
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Update patient_messages RLS policies to allow admin access
DROP POLICY IF EXISTS "allow_practice_view_patient_messages" ON patient_messages;
CREATE POLICY "allow_practice_view_patient_messages" ON patient_messages FOR SELECT
USING (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admin bypass for impersonation
  OR patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "allow_practice_insert_patient_messages" ON patient_messages;
CREATE POLICY "allow_practice_insert_patient_messages" ON patient_messages FOR INSERT
WITH CHECK (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admin bypass for impersonation
  OR patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "allow_practice_update_patient_messages" ON patient_messages;
CREATE POLICY "allow_practice_update_patient_messages" ON patient_messages FOR UPDATE
USING (
  practice_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admin bypass for impersonation
  OR patient_id IN (SELECT id FROM patient_accounts WHERE user_id = auth.uid())
);