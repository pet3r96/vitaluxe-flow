
-- Drop the old overloaded versions that cause ambiguity (22P02 errors)
-- Keep only the 10-param version with correct types

-- 1. Drop the original 5-param version
DROP FUNCTION IF EXISTS public.create_user_with_role(uuid, text, text, app_role, jsonb);

-- 2. Drop the 8-param version with p_role text, p_temp_password text
DROP FUNCTION IF EXISTS public.create_user_with_role(uuid, text, text, text, jsonb, text, text, uuid);

-- 3. Drop the 8-param version with p_role app_role, p_temp_password boolean
DROP FUNCTION IF EXISTS public.create_user_with_role(uuid, text, text, app_role, jsonb, text, uuid, boolean);

-- The remaining 10-param version is kept:
-- create_user_with_role(uuid, text, text, app_role, jsonb, text, uuid, boolean, text, text)
-- which has: p_user_id, p_email, p_name, p_role, p_role_data, p_status, p_created_by, p_temp_password, p_full_name, p_prescriber_name
