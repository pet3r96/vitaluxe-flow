-- Comprehensive staff access policies - pass practice_id everywhere
-- This fixes: calendar, notes, patients, providers, rooms, support tickets for staff

-- ============================================================================
-- PROVIDERS: Staff can view and update providers in their practice
-- ============================================================================
CREATE POLICY "Staff can view practice providers" 
ON public.providers FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = providers.practice_id
  )
);

CREATE POLICY "Staff can update practice providers" 
ON public.providers FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = providers.practice_id
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = providers.practice_id
  )
);

-- ============================================================================
-- PRACTICE_ROOMS: Staff can manage rooms in their practice
-- ============================================================================
CREATE POLICY "Staff manage their practice rooms" 
ON public.practice_rooms FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = practice_rooms.practice_id
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = practice_rooms.practice_id
  )
);

-- ============================================================================
-- SUPPORT_TICKETS: Staff can view, create, and update practice tickets
-- ============================================================================
CREATE POLICY "Staff view practice tickets" 
ON public.support_tickets FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = support_tickets.practice_id
  )
);

CREATE POLICY "Staff create practice tickets" 
ON public.support_tickets FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = support_tickets.practice_id
  )
  AND created_by = auth.uid()
  AND created_by_role = 'staff'
);

CREATE POLICY "Staff update practice tickets" 
ON public.support_tickets FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = support_tickets.practice_id
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM practice_staff ps 
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND ps.practice_id = support_tickets.practice_id
  )
);

-- ============================================================================
-- PATIENT_NOTES: Clean up and add staff view access
-- ============================================================================
-- Drop obsolete policy that blocks staff
DROP POLICY IF EXISTS "staff_create_notes" ON public.patient_notes;

-- Staff can view notes for patients in their practice
CREATE POLICY "Staff view practice patient notes" 
ON public.patient_notes FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM practice_staff ps
    JOIN patient_accounts pa ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid() 
    AND ps.active = true 
    AND pa.id = patient_notes.patient_account_id
  )
);