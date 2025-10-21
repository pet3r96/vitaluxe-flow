-- Add indexes for efficient session cleanup and validation
-- These indexes support the idle timeout system by optimizing queries for stale sessions

-- Index for efficient cleanup of stale sessions (ORDER BY last_activity)
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity 
ON active_sessions(last_activity);

-- Index for user session lookups (WHERE user_id = ?)
CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id 
ON active_sessions(user_id);

-- Add comment explaining cleanup policy
COMMENT ON TABLE active_sessions IS 
'Session tracking with 30-minute idle timeout. Sessions with last_activity > 30 min are automatically cleaned up by scheduled edge function every 15 minutes.';

COMMENT ON COLUMN active_sessions.last_activity IS
'Timestamp of last user activity. Updated by client on interactions (throttled to 30s). Used to detect idle sessions for automatic logout.';