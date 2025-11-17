-- Enable RLS on patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Admins full access
CREATE POLICY "Admins manage all patients"
  ON patients
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Practice staff can view patients in their own practice
CREATE POLICY "Practice staff view their patients"
  ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM practice_staff ps
      WHERE ps.practice_id = patients.practice_id
        AND ps.user_id = auth.uid()
        AND ps.active = true
    )
  );