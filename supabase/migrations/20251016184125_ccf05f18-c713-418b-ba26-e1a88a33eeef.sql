-- Enable JWT verification for send-welcome-email edge function
-- This function should only be callable from other authenticated edge functions
-- Update via config.toml: [functions.send-welcome-email] verify_jwt = true

-- Note: The actual change needs to be made in supabase/config.toml
-- This migration is just for documentation purposes

-- Add a comment to track this security improvement
COMMENT ON FUNCTION extensions.uuid_generate_v4() IS 'Security note: send-welcome-email edge function JWT verification should be enabled in config.toml';