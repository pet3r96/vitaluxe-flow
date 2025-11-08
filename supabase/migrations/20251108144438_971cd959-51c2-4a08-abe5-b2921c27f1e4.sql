-- Allow guest links to be reused multiple times (for reconnections)
-- Change max_uses default from 1 to 999 (effectively unlimited)
ALTER TABLE video_session_guest_links 
ALTER COLUMN max_uses SET DEFAULT 999;

-- Update existing guest links to allow reconnections
UPDATE video_session_guest_links 
SET max_uses = 999 
WHERE max_uses = 1;

-- Add comment explaining the change
COMMENT ON COLUMN video_session_guest_links.max_uses IS 'Number of times link can be used. Default 999 allows reconnections. Links expire based on session status and appointment time instead.';