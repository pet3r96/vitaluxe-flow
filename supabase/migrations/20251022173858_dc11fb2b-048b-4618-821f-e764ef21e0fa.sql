-- Fix terms acceptance redirect loop issue
-- Ensure all users who have accepted terms have a corresponding user_password_status row

-- Insert missing user_password_status rows for users who have accepted terms
INSERT INTO user_password_status (user_id, must_change_password, terms_accepted)
SELECT DISTINCT 
  uta.user_id,
  false as must_change_password,
  true as terms_accepted
FROM user_terms_acceptances uta
LEFT JOIN user_password_status ups ON ups.user_id = uta.user_id
WHERE ups.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE 
SET terms_accepted = true,
    updated_at = now();

-- Log the fix
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT uta.user_id)
  INTO fixed_count
  FROM user_terms_acceptances uta
  LEFT JOIN user_password_status ups ON ups.user_id = uta.user_id
  WHERE ups.user_id IS NULL;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE 'Fixed % users with accepted terms but missing user_password_status rows', fixed_count;
  END IF;
END $$;