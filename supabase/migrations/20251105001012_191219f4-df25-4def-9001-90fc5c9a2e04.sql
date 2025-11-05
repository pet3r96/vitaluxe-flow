-- Function to disable/ban an auth user (SECURITY DEFINER for admin access)
CREATE OR REPLACE FUNCTION public.disable_auth_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ban the user indefinitely by setting banned_until to far future
  UPDATE auth.users
  SET banned_until = '2099-12-31 23:59:59+00'::timestamptz
  WHERE id = p_user_id;
END;
$$;

-- Trigger function to handle patient email changes
CREATE OR REPLACE FUNCTION public.handle_patient_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_email text;
BEGIN
  -- Only proceed if email is actually changing
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    v_old_email := OLD.email;
    
    -- If patient has an active portal account (user_id exists)
    IF OLD.user_id IS NOT NULL THEN
      -- Disable the old auth account
      PERFORM disable_auth_user(OLD.user_id);
      
      -- Clear the portal access link
      NEW.user_id := NULL;
      NEW.invitation_sent_at := NULL;
      
      -- Log the action for audit trail
      INSERT INTO audit_logs (
        user_id,
        user_email,
        action_type,
        entity_type,
        entity_id,
        details
      ) VALUES (
        auth.uid(),
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'patient_email_changed_portal_reset',
        'patient_accounts',
        NEW.id,
        jsonb_build_object(
          'old_email', v_old_email,
          'new_email', NEW.email,
          'old_user_id', OLD.user_id,
          'action', 'Portal access reset due to email change'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on patient_accounts for email changes
DROP TRIGGER IF EXISTS before_patient_email_update ON patient_accounts;
CREATE TRIGGER before_patient_email_update
  BEFORE UPDATE ON patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION handle_patient_email_change();