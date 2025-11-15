-- ============================================================================
-- DEMO PRACTICE 1 COMPREHENSIVE FIX
-- Fixes all dual role conflicts and sets meta_roles for fast authentication
-- ============================================================================

-- FIX 1: demostafff@yahoo.com (staff locked out)
-- Current: user_roles='staff', staff_active=false, provider_active=true
-- Fix: Activate staff, deactivate provider, set meta_role='staff'
-- ============================================================================
UPDATE practice_staff 
SET active = true 
WHERE user_id = '58f2d050-f644-4603-b670-be2b3e999488';

UPDATE providers 
SET active = false 
WHERE user_id = '58f2d050-f644-4603-b670-be2b3e999488';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"staff"'::jsonb
)
WHERE id = '58f2d050-f644-4603-b670-be2b3e999488';

-- FIX 2: denis@mdequitygroup.com (convert staff to provider)
-- Current: user_roles='staff', has 6 provider orders
-- Fix: Remove staff role, set provider role, ensure provider active, set meta_role='provider'
-- ============================================================================
DELETE FROM user_roles 
WHERE user_id = 'd54d5a06-0845-464d-8650-b054e78a48bf' 
  AND role = 'staff';

INSERT INTO user_roles (user_id, role) 
VALUES ('d54d5a06-0845-464d-8650-b054e78a48bf', 'provider')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM practice_staff 
WHERE user_id = 'd54d5a06-0845-464d-8650-b054e78a48bf';

UPDATE providers 
SET active = true 
WHERE user_id = 'd54d5a06-0845-464d-8650-b054e78a48bf';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"provider"'::jsonb
)
WHERE id = 'd54d5a06-0845-464d-8650-b054e78a48bf';

-- FIX 3: Set missing meta_roles for all other users
-- Improves auth resolution from 200-300ms to < 10ms
-- ============================================================================

-- sporn.dylan@gmail.com: practice owner (has 'doctor' role)
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"doctor"'::jsonb
)
WHERE id = '2feb9460-5943-4f23-a2a5-1801103c2952'
  AND (raw_user_meta_data->>'role' IS NULL 
       OR raw_user_meta_data->>'role' = '');

-- denis2929@aol.com: provider with 0 orders
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"provider"'::jsonb
)
WHERE id = '0a9ef2a9-fae9-408b-84f9-518e27c13613'
  AND (raw_user_meta_data->>'role' IS NULL 
       OR raw_user_meta_data->>'role' = '');

-- dylan@nlcfund.com: provider with 17 orders
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb), 
  '{role}', 
  '"provider"'::jsonb
)
WHERE id = '9684f7bc-71b7-4a21-8d39-565124882420'
  AND (raw_user_meta_data->>'role' IS NULL 
       OR raw_user_meta_data->>'role' = '');