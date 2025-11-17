-------------------------------------------------------
-- PHASE 4 — POLICY CONSOLIDATION / CLEANUP BATCH 3
-- TARGET TABLES: practice_staff, pharmacies
-------------------------------------------------------

-----------------------------
-- 1️⃣ PRACTICE_STAFF TABLE
-----------------------------

-- REMOVE OLD POLICIES
DO $$
DECLARE p text;
BEGIN
  FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = 'practice_staff')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON practice_staff;', p);
  END LOOP;
END$$;

-- CREATE CLEAN POLICY SET

-- ADMIN — full access
CREATE POLICY "admin_all_practice_staff"
  ON practice_staff FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PRACTICE OWNER — manage own staff
CREATE POLICY "practice_owner_manage_staff"
  ON practice_staff FOR ALL
  USING (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id IN (
      SELECT practice_id FROM practice_staff
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- STAFF — view and update their own record
CREATE POLICY "staff_view_own_record"
  ON practice_staff FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_update_own_record"
  ON practice_staff FOR UPDATE USING (user_id = auth.uid());

-----------------------------
-- 2️⃣ PHARMACIES TABLE
-----------------------------

-- REMOVE OLD POLICIES
DO $$
DECLARE p text;
BEGIN
  FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = 'pharmacies')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON pharmacies;', p);
  END LOOP;
END$$;

-- CREATE CLEAN POLICY SET

-- ADMIN — full access
CREATE POLICY "admin_all_pharmacies"
  ON pharmacies FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PHARMACY USER — manage own pharmacy record
CREATE POLICY "pharmacy_manage_own_record"
  ON pharmacies FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- PATIENTS / PUBLIC — view active pharmacies
CREATE POLICY "public_view_active_pharmacies"
  ON pharmacies FOR SELECT
  USING (active = true);