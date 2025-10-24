-- Verify Token Password Reset Schema
-- Run this to check if the database schema is correct

-- Check if temp_password_tokens table exists and has correct structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'temp_password_tokens' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if used_at column exists
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'temp_password_tokens' 
AND column_name = 'used_at';

-- Check recent tokens (if any exist)
SELECT 
    id,
    user_id,
    token,
    created_at,
    expires_at,
    used,
    used_at
FROM temp_password_tokens 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are any unused tokens
SELECT 
    COUNT(*) as unused_tokens
FROM temp_password_tokens 
WHERE used_at IS NULL 
AND expires_at > NOW();

-- Check if there are any expired tokens
SELECT 
    COUNT(*) as expired_tokens
FROM temp_password_tokens 
WHERE expires_at < NOW();

-- Check user_password_status table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_password_status' 
AND table_schema = 'public'
ORDER BY ordinal_position;
