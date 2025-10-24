-- Fix the temp_password_tokens table schema to match the code expectations
-- The code expects a 'used_at' timestamp field, but the table only has 'used' boolean

-- Add the used_at field to the temp_password_tokens table
ALTER TABLE public.temp_password_tokens 
ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- Update existing records to set used_at where used is true
UPDATE public.temp_password_tokens 
SET used_at = created_at 
WHERE used = true AND used_at IS NULL;

-- Create an index on used_at for performance
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_used_at ON public.temp_password_tokens(used_at);

-- The 'used' boolean field is kept for backwards compatibility
-- but the code now uses 'used_at' for consistency
