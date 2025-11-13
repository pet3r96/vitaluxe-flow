-- Create video_session_events table for realtime signaling
CREATE TABLE IF NOT EXISTS public.video_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_video_session_events_session_id ON public.video_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_video_session_events_created_at ON public.video_session_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.video_session_events ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and insert events
CREATE POLICY "Authenticated users can insert events"
ON public.video_session_events
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view events"
ON public.video_session_events
FOR SELECT
TO authenticated
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_session_events;