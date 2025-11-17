-------------------------------------------------------
-- PHASE 4 — POLICY CONSOLIDATION / CLEANUP BATCH 2
-- TARGET TABLES: providers, profiles
-------------------------------------------------------

-----------------------------
-- 1️⃣ PROVIDERS TABLE
-----------------------------

-- REMOVE ALL OLD POLICIES
DO $$
DECLARE p text;
BEGIN
  FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = 'providers')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON providers;', p);
  END LOOP;
END$$;

-- CREATE CLEAN POLICY SET

-- ADMIN — Full access
CREATE POLICY "admin_all_providers"
  ON providers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PRACTICE OWNERS — Manage all providers in their practice
CREATE POLICY "practice_manage_providers"
  ON providers FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

-- PROVIDERS — View and update their own provider record
CREATE POLICY "provider_manage_own_provider_record"
  ON providers FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "provider_update_own_provider_record"
  ON providers FOR UPDATE USING (user_id = auth.uid());

-- STAFF — View providers in their practice
CREATE POLICY "staff_view_practice_providers"
  ON providers FOR SELECT
  USING (
    practice_id IN (
      SELECT practice_id FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );


-----------------------------
-- 2️⃣ PROFILES TABLE
-----------------------------

-- REMOVE ALL OLD POLICIES
DO $$
DECLARE p text;
BEGIN
  FOR p IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles;', p);
  END LOOP;
END$$;

-- CREATE CLEAN POLICY SET

-- ADMIN — Can view and update all profiles
CREATE POLICY "admin_all_profiles"
  ON profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- USERS — View and update their OWN profile
CREATE POLICY "user_view_own_profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_update_own_profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- PRACTICE OWNERS — View practice staff and providers profiles
CREATE POLICY "practice_owner_view_profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM practice_staff 
      WHERE practice_id = auth.uid() AND active = true
    )
  );

-- TOPLINE — View downline practice profiles
CREATE POLICY "topline_view_downline_profiles"
  ON profiles FOR SELECT
  USING (
    linked_topline_id = auth.uid()
  );