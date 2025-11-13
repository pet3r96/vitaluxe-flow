-- ============================================================================
-- PHASE 1: VIDEO CONSULTATION SCHEMA EXTENSIONS
-- Creates practice room and guest token tables for video system
-- ============================================================================

-- Function to generate unique 8-character room keys (e.g., "abc12345")
CREATE OR REPLACE FUNCTION public.generate_room_key()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  key TEXT;
  key_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric key
    key := substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);
    
    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM public.practice_video_rooms WHERE room_key = key) INTO key_exists;
    
    EXIT WHEN NOT key_exists;
  END LOOP;
  
  RETURN key;
END;
$$;

-- Function to generate secure guest tokens (32-character random string)
CREATE OR REPLACE FUNCTION public.generate_guest_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate secure random token (32 characters)
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(replace(replace(token, '+', ''), '/', ''), '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.video_guest_tokens WHERE token = token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN token;
END;
$$;

-- Create practice_video_rooms table
-- Each practice gets one permanent video room with a unique link
CREATE TABLE IF NOT EXISTS public.practice_video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_key TEXT UNIQUE NOT NULL DEFAULT generate_room_key(),
  channel_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for practice_video_rooms
CREATE INDEX IF NOT EXISTS idx_practice_video_rooms_practice_id ON public.practice_video_rooms(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_video_rooms_room_key ON public.practice_video_rooms(room_key);

-- Enable RLS on practice_video_rooms
ALTER TABLE public.practice_video_rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only practice members can view their practice room
CREATE POLICY "Practice members can view their practice room"
ON public.practice_video_rooms
FOR SELECT
USING (
  practice_id = auth.uid() OR -- Practice owner
  EXISTS ( -- Provider in practice
    SELECT 1 FROM public.providers
    WHERE user_id = auth.uid() AND practice_id = practice_video_rooms.practice_id
  ) OR
  EXISTS ( -- Staff in practice (if table exists)
    SELECT 1 FROM public.practice_staff
    WHERE user_id = auth.uid() AND practice_id = practice_video_rooms.practice_id
  )
);

-- Create video_guest_tokens table
-- Stores time-limited tokens for guest access to video sessions
CREATE TABLE IF NOT EXISTS public.video_guest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT generate_guest_token(),
  guest_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for video_guest_tokens
CREATE INDEX IF NOT EXISTS idx_video_guest_tokens_token ON public.video_guest_tokens(token);
CREATE INDEX IF NOT EXISTS idx_video_guest_tokens_session_id ON public.video_guest_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_video_guest_tokens_expires_at ON public.video_guest_tokens(expires_at);

-- Enable RLS on video_guest_tokens
ALTER TABLE public.video_guest_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Practice members can create guest tokens for their sessions
CREATE POLICY "Practice members can create guest tokens"
ON public.video_guest_tokens
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.video_sessions vs
    WHERE vs.id = session_id
    AND (
      vs.practice_id = auth.uid() OR -- Practice owner
      EXISTS ( -- Provider in practice
        SELECT 1 FROM public.providers
        WHERE user_id = auth.uid() AND practice_id = vs.practice_id
      ) OR
      EXISTS ( -- Staff in practice
        SELECT 1 FROM public.practice_staff
        WHERE user_id = auth.uid() AND practice_id = vs.practice_id
      )
    )
  )
);

-- RLS Policy: Practice members can view guest tokens for their sessions
CREATE POLICY "Practice members can view their guest tokens"
ON public.video_guest_tokens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.video_sessions vs
    WHERE vs.id = session_id
    AND (
      vs.practice_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.providers
        WHERE user_id = auth.uid() AND practice_id = vs.practice_id
      ) OR
      EXISTS (
        SELECT 1 FROM public.practice_staff
        WHERE user_id = auth.uid() AND practice_id = vs.practice_id
      )
    )
  )
);

-- Extend video_sessions if needed
ALTER TABLE public.video_sessions 
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'instant';

-- Add check constraint for session_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'video_sessions_session_type_check'
  ) THEN
    ALTER TABLE public.video_sessions
    ADD CONSTRAINT video_sessions_session_type_check
    CHECK (session_type IN ('instant', 'scheduled', 'practice_room'));
  END IF;
END $$;

-- Comment on tables and columns for documentation
COMMENT ON TABLE public.practice_video_rooms IS 'Permanent video rooms for each practice with unique join links';
COMMENT ON TABLE public.video_guest_tokens IS 'Time-limited tokens for guest access to video sessions';
COMMENT ON COLUMN public.practice_video_rooms.room_key IS 'Unique 8-character key used in URL /practice/video/room/{room_key}';
COMMENT ON COLUMN public.video_guest_tokens.token IS 'Secure 32-character token for guest access';
COMMENT ON COLUMN public.video_guest_tokens.expires_at IS 'Token expiration time (default: 1 hour from creation)';
COMMENT ON COLUMN public.video_sessions.session_type IS 'Type of session: instant, scheduled, or practice_room';

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger for practice_video_rooms
DROP TRIGGER IF EXISTS update_practice_video_rooms_updated_at ON public.practice_video_rooms;
CREATE TRIGGER update_practice_video_rooms_updated_at
  BEFORE UPDATE ON public.practice_video_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();