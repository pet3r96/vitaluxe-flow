-- Add vios_practice_id column to profiles table for VIOS API order submissions
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS vios_practice_id text;

COMMENT ON COLUMN profiles.vios_practice_id IS 'VIOS Practice ID assigned during VIOS onboarding. Required for API order submissions to identify the practice.';