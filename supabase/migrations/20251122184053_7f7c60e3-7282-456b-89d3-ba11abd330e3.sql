-- Create practice_video_rooms table
-- This table stores persistent video room information for practices

CREATE TABLE IF NOT EXISTS practice_video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL UNIQUE,
  room_key TEXT NOT NULL UNIQUE,
  active_session_id UUID REFERENCES video_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_practice_video_rooms_practice_id ON practice_video_rooms(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_video_rooms_room_key ON practice_video_rooms(room_key);
CREATE INDEX IF NOT EXISTS idx_practice_video_rooms_channel_name ON practice_video_rooms(channel_name);

-- Enable RLS
ALTER TABLE practice_video_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Practice members can view their own room
CREATE POLICY "Practice members can view their practice video room"
  ON practice_video_rooms
  FOR SELECT
  USING (
    practice_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM providers 
      WHERE providers.practice_id = practice_video_rooms.practice_id 
      AND providers.user_id = auth.uid()
    )
  );

-- Policy: Practice staff can update their room
CREATE POLICY "Practice staff can update their practice video room"
  ON practice_video_rooms
  FOR UPDATE
  USING (
    practice_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM providers 
      WHERE providers.practice_id = practice_video_rooms.practice_id 
      AND providers.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_practice_video_rooms_updated_at
  BEFORE UPDATE ON practice_video_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();