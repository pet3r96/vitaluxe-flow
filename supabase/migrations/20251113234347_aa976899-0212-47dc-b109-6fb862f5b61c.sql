-- ============================================================================
-- SUPER ADMIN IMPERSONATION: Phase 1A - Add super_admin Role to Enum
-- ============================================================================

-- Add super_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Add comment explaining super_admin role
COMMENT ON TYPE public.app_role IS 'Application roles: super_admin (can impersonate any user), admin (full system access), doctor (practice owner), staff (practice staff), provider (medical provider), patient (end user), pharmacy (pharmacy staff), rep (sales rep)';