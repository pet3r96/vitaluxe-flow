-----------------------------------------------
-- BATCH: ENABLE RLS ON TWO HIGH-RISK TABLES --
-----------------------------------------------

-- 1) PATIENT NOTES -------------------------------------

ALTER TABLE patient_notes ENABLE ROW LEVEL SECURITY;

-- Providers can view notes for their own patients
CREATE POLICY "Providers view patient notes"
  ON patient_notes
  FOR SELECT
  USING (
    patient_account_id IN (
      SELECT pa.id
      FROM patient_accounts pa
      JOIN providers p ON p.practice_id = pa.practice_id
      WHERE p.user_id = auth.uid()
        AND p.active = true
    )
  );

-- Practice staff can view notes for their practice's patients
CREATE POLICY "Staff view patient notes"
  ON patient_notes
  FOR SELECT
  USING (
    patient_account_id IN (
      SELECT pa.id
      FROM patient_accounts pa
      JOIN practice_staff ps ON ps.practice_id = pa.practice_id
      WHERE ps.user_id = auth.uid()
        AND ps.active = true
    )
  );

-- Admin full access
CREATE POLICY "Admin manage patient notes"
  ON patient_notes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));


-- 2) PATIENT FOLLOW-UPS --------------------------------

ALTER TABLE patient_follow_ups ENABLE ROW LEVEL SECURITY;

-- Providers can view follow-ups for their own patients
CREATE POLICY "Providers view follow ups"
  ON patient_follow_ups
  FOR SELECT
  USING (
    patient_id IN (
      SELECT pa.id
      FROM patient_accounts pa
      JOIN providers p ON p.practice_id = pa.practice_id
      WHERE p.user_id = auth.uid()
        AND p.active = true
    )
  );

-- Practice staff can view follow-ups for their practice's patients
CREATE POLICY "Staff view follow ups"
  ON patient_follow_ups
  FOR SELECT
  USING (
    patient_id IN (
      SELECT pa.id
      FROM patient_accounts pa
      JOIN practice_staff ps ON ps.practice_id = pa.practice_id
      WHERE ps.user_id = auth.uid()
        AND ps.active = true
    )
  );

-- Admin full access
CREATE POLICY "Admin manage follow ups"
  ON patient_follow_ups
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));