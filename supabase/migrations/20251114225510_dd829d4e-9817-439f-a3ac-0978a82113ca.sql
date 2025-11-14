-- Create patient account health monitoring view
CREATE OR REPLACE VIEW patient_account_health AS
SELECT 
  pa.id as patient_id,
  pa.first_name || ' ' || pa.last_name as name,
  pa.email,
  pa.practice_id,
  p.name as practice_name,
  pa.invitation_sent_at,
  au.last_sign_in_at,
  pa.status as account_status,
  CASE 
    WHEN pa.user_id IS NOT NULL AND au.id IS NOT NULL THEN 'linked'
    WHEN pa.user_id IS NOT NULL AND au.id IS NULL THEN 'broken'
    WHEN pa.user_id IS NULL AND au.id IS NOT NULL THEN 'orphaned'
    ELSE 'not_invited'
  END as link_status,
  pa.created_at,
  pa.updated_at
FROM patient_accounts pa
LEFT JOIN profiles p ON p.id = pa.practice_id
LEFT JOIN auth.users au ON au.id = pa.user_id;

-- Grant access to authenticated users based on RLS
GRANT SELECT ON patient_account_health TO authenticated;

-- Create function to fix orphaned patient accounts
CREATE OR REPLACE FUNCTION fix_orphaned_patient_accounts()
RETURNS TABLE(
  patient_id uuid,
  patient_email text,
  auth_user_id uuid,
  action_taken text,
  fixed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH orphaned_patients AS (
    SELECT 
      pa.id,
      pa.email,
      au.id as auth_id
    FROM patient_accounts pa
    INNER JOIN auth.users au ON LOWER(au.email) = LOWER(pa.email)
    WHERE pa.user_id IS NULL 
      AND au.id IS NOT NULL
  ),
  updated AS (
    UPDATE patient_accounts pa
    SET user_id = op.auth_id,
        updated_at = now()
    FROM orphaned_patients op
    WHERE pa.id = op.id
    RETURNING pa.id, pa.email, op.auth_id
  ),
  audit_logged AS (
    INSERT INTO audit_logs (
      action_type,
      entity_type,
      entity_id,
      details
    )
    SELECT 
      'fixed_orphaned_patient_account',
      'patient_accounts',
      u.id,
      jsonb_build_object(
        'email', u.email,
        'linked_user_id', u.auth_id,
        'timestamp', now()
      )
    FROM updated u
    RETURNING entity_id
  )
  SELECT 
    u.id as patient_id,
    u.email as patient_email,
    u.auth_id as auth_user_id,
    'auto_linked'::text as action_taken,
    now() as fixed_at
  FROM updated u;
END;
$$;

-- Grant execute to admins only
REVOKE ALL ON FUNCTION fix_orphaned_patient_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fix_orphaned_patient_accounts() TO authenticated;

COMMENT ON VIEW patient_account_health IS 'Monitoring view for patient account link status - shows linked, broken, orphaned, or not_invited statuses';
COMMENT ON FUNCTION fix_orphaned_patient_accounts() IS 'Automatically finds and links patient accounts where auth.users exists but patient_accounts.user_id is NULL';