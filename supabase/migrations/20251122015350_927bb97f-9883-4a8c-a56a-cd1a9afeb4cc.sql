-- Add 'waiting' status to video_sessions enum
ALTER TABLE video_sessions 
  DROP CONSTRAINT IF EXISTS video_sessions_status_check;

ALTER TABLE video_sessions 
  ADD CONSTRAINT video_sessions_status_check 
  CHECK (status IN ('scheduled', 'waiting', 'live', 'ended', 'cancelled'));