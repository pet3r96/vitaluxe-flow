-- Add RLS policy for staff users in providers table to manage appointments
-- This allows staff members (stored in providers table with role_type starting with 'staff_')
-- who are active to manage all appointments for their practice

CREATE POLICY "Staff in providers table can manage practice appointments"
ON patient_appointments
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.role_type LIKE 'staff_%'
      AND p.active = true
      AND p.practice_id = patient_appointments.practice_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM providers p
    WHERE p.user_id = auth.uid()
      AND p.role_type LIKE 'staff_%'
      AND p.active = true
      AND p.practice_id = patient_appointments.practice_id
  )
);