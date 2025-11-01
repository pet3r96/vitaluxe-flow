-- Migration: Fix appointment cancellation during impersonation
-- Issue: Missing 'revoked' column in active_impersonation_sessions table

-- Add revoked column to track revoked impersonation sessions
ALTER TABLE active_impersonation_sessions 
ADD COLUMN IF NOT EXISTS revoked BOOLEAN DEFAULT FALSE;

-- Add index for performance when filtering active sessions
CREATE INDEX IF NOT EXISTS idx_active_impersonation_sessions_revoked 
ON active_impersonation_sessions(revoked);

-- Add comment for documentation
COMMENT ON COLUMN active_impersonation_sessions.revoked IS 
'Indicates if the impersonation session has been manually revoked by admin';