-- Backfill user_password_status for existing users
-- This ensures existing users can continue using their current passwords
-- without being forced to change them
INSERT INTO user_password_status (user_id, must_change_password, temporary_password_sent, first_login_completed)
SELECT 
  au.id as user_id,
  false as must_change_password,  -- Existing users don't need to change password
  false as temporary_password_sent,  -- They weren't sent temporary passwords
  true as first_login_completed  -- Treat as if they've already logged in
FROM auth.users au
LEFT JOIN user_password_status ups ON au.id = ups.user_id
WHERE ups.user_id IS NULL;  -- Only for users who don't have a record yet