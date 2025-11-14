-- Step 1: Delete the duplicate Demo Patient 4 record
DELETE FROM patient_accounts
WHERE id = 'd79c3e89-7e1b-426a-88bb-bfed1f79588b'
  AND email = 'petersporn96@gmail.com';

-- Step 2: Link Demo Patient 2 to their authenticated user
UPDATE patient_accounts
SET user_id = '1734905a-a954-44ee-a0e9-c9f206da3b16',
    updated_at = now()
WHERE id = 'a7a23de3-2e27-4679-a5a9-b36fc6d08347'
  AND email = 'petersporn96@gmail.com';

-- Step 3: Preventive measure - Auto-link patient accounts to auth users by email
CREATE OR REPLACE FUNCTION auto_link_patient_to_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  -- If user_id is NULL and email is provided
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    -- Try to find matching auth user by email
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(NEW.email)
    LIMIT 1;
    
    -- If found, auto-link
    IF v_auth_user_id IS NOT NULL THEN
      NEW.user_id := v_auth_user_id;
      
      -- Log the auto-linking for audit
      INSERT INTO audit_logs (
        action_type,
        entity_type,
        entity_id,
        details
      ) VALUES (
        'auto_linked_patient_account',
        'patient_accounts',
        NEW.id,
        jsonb_build_object(
          'email', NEW.email,
          'linked_user_id', v_auth_user_id,
          'timestamp', now()
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_link_patient_account ON patient_accounts;
CREATE TRIGGER auto_link_patient_account
  BEFORE INSERT OR UPDATE ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_patient_to_auth_user();