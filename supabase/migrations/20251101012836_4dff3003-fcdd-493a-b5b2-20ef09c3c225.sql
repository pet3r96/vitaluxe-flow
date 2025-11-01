-- Data cleanup and validation migration
-- 1. Clean up patients with NULL emails by setting a placeholder
-- 2. Add NOT NULL constraint to email field (with default for migration safety)
-- 3. Clean up any orphaned cart_lines that reference non-existent patients

-- Step 1: Update NULL emails to prevent constraint violations during migration
UPDATE patient_accounts
SET email = 'no-email-' || id || '@pending.local'
WHERE email IS NULL OR email = '';

-- Step 2: Add NOT NULL constraint with a default value
ALTER TABLE patient_accounts 
ALTER COLUMN email SET DEFAULT 'pending@example.com',
ALTER COLUMN email SET NOT NULL;

-- Step 3: Clean up orphaned cart_lines (patient_id references non-existent patients)
DELETE FROM cart_lines
WHERE patient_id IS NOT NULL 
AND patient_id NOT IN (SELECT id FROM patient_accounts);

-- Step 4: Add a comment to document the email requirement
COMMENT ON COLUMN patient_accounts.email IS 'Patient email address (required for portal access and orders)';