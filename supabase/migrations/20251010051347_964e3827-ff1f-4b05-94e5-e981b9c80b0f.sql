-- Fix provider account roles
-- Update user roles for users who exist in the providers table
-- but are incorrectly marked as 'doctor' instead of 'provider'
UPDATE user_roles
SET role = 'provider'
WHERE user_id IN (
  SELECT DISTINCT user_id 
  FROM providers 
  WHERE user_id IS NOT NULL
)
AND role = 'doctor';