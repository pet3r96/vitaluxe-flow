-- Create trigger to sync patient_accounts to profiles
CREATE OR REPLACE FUNCTION public.sync_patient_account_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile name when patient_account is created/updated
  UPDATE profiles
  SET 
    name = CONCAT(NEW.first_name, ' ', NEW.last_name),
    updated_at = NOW()
  WHERE id = NEW.user_id
    AND (name = 'New User' OR name IS NULL OR name = '');
  
  -- Ensure patient role exists
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.user_id, 'patient'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on patient_accounts
DROP TRIGGER IF EXISTS trigger_sync_patient_account_to_profile ON patient_accounts;
CREATE TRIGGER trigger_sync_patient_account_to_profile
  AFTER INSERT OR UPDATE ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION sync_patient_account_to_profile();

-- Enhance handle_new_user() to detect patient role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with better default name handling
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email
  );
  
  -- Auto-create patient role if specified in user_metadata
  IF (NEW.raw_user_meta_data->>'role') = 'patient' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Repair existing orphaned patient records
DO $$
DECLARE
  v_repaired_count INTEGER := 0;
  v_patient RECORD;
BEGIN
  -- Fix all patient_accounts where profile name is 'New User'
  FOR v_patient IN 
    SELECT 
      pa.user_id,
      pa.first_name,
      pa.last_name,
      p.name as current_name
    FROM patient_accounts pa
    LEFT JOIN profiles p ON p.id = pa.user_id
    WHERE p.name = 'New User' OR p.name IS NULL OR p.name = ''
  LOOP
    -- Update profile name
    UPDATE profiles
    SET 
      name = CONCAT(v_patient.first_name, ' ', v_patient.last_name),
      updated_at = NOW()
    WHERE id = v_patient.user_id;
    
    -- Ensure patient role exists
    INSERT INTO user_roles (user_id, role)
    VALUES (v_patient.user_id, 'patient'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    v_repaired_count := v_repaired_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Repaired % patient account profiles', v_repaired_count;
END $$;