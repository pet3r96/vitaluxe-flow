-- Failsafe policy: allow users to SELECT their own profile
DROP POLICY IF EXISTS "profiles_self_read_failsafe" ON profiles;
CREATE POLICY "profiles_self_read_failsafe"
  ON profiles FOR SELECT
  USING (id = auth.uid());