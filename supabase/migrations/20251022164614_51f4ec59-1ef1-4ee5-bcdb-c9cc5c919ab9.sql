-- Fix #3: Add unique constraint and indexes to active_sessions table
-- Ensure only one active session per user
ALTER TABLE public.active_sessions
ADD CONSTRAINT active_sessions_user_id_key UNIQUE (user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id 
ON public.active_sessions(user_id);

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity 
ON public.active_sessions(last_activity);