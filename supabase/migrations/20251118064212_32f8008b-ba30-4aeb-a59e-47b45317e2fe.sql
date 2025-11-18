
-- Function to check if user has multiple non-admin roles
CREATE OR REPLACE FUNCTION check_single_primary_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role NOT IN ('admin', 'super_admin') THEN
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.user_id 
        AND role NOT IN ('admin', 'super_admin', NEW.role)
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'User already has a primary role. Cannot assign multiple primary roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to enforce single primary role
DROP TRIGGER IF EXISTS enforce_single_primary_role ON user_roles;
CREATE TRIGGER enforce_single_primary_role
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION check_single_primary_role();
