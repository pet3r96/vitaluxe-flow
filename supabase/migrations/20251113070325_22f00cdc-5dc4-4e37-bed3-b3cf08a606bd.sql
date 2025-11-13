-- ============================================================================
-- TELEHEALTH INFRASTRUCTURE TABLES
-- ============================================================================

-- 1. VIDEO SESSIONS TABLE
-- Tracks both instant and scheduled video consultations
CREATE TABLE IF NOT EXISTS public.video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patient_accounts(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL UNIQUE,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  session_type TEXT NOT NULL DEFAULT 'instant' CHECK (session_type IN ('instant', 'scheduled', 'practice_room')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by practice and status
CREATE INDEX IF NOT EXISTS idx_video_sessions_practice_status ON public.video_sessions(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_provider ON public.video_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_patient ON public.video_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_channel ON public.video_sessions(channel_name);

-- Enable RLS
ALTER TABLE public.video_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for video_sessions
CREATE POLICY "Providers can view their practice sessions"
  ON public.video_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid()
        AND p.practice_id = video_sessions.practice_id
    )
  );

CREATE POLICY "Patients can view their own sessions"
  ON public.video_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_accounts pa
      WHERE pa.user_id = auth.uid()
        AND pa.id = video_sessions.patient_id
    )
  );

CREATE POLICY "Providers can create sessions for their practice"
  ON public.video_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid()
        AND p.practice_id = video_sessions.practice_id
    )
  );

CREATE POLICY "Providers can update their practice sessions"
  ON public.video_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid()
        AND p.practice_id = video_sessions.practice_id
    )
  );

-- ============================================================================
-- 2. PRACTICE VIDEO ROOMS TABLE
-- One persistent room per practice for instant access
CREATE TABLE IF NOT EXISTS public.practice_video_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_name TEXT NOT NULL UNIQUE,
  room_key TEXT NOT NULL UNIQUE,
  active_session_id UUID REFERENCES public.video_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by room_key
CREATE INDEX IF NOT EXISTS idx_practice_rooms_key ON public.practice_video_rooms(room_key);

-- Enable RLS
ALTER TABLE public.practice_video_rooms ENABLE ROW LEVEL SECURITY;

-- Policies for practice_video_rooms
CREATE POLICY "Providers can view their practice room"
  ON public.practice_video_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid()
        AND p.practice_id = practice_video_rooms.practice_id
    )
  );

CREATE POLICY "Providers can create/update their practice room"
  ON public.practice_video_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.user_id = auth.uid()
        AND p.practice_id = practice_video_rooms.practice_id
    )
  );

-- ============================================================================
-- 3. VIDEO GUEST TOKENS TABLE
-- Secure guest access links with expiration
CREATE TABLE IF NOT EXISTS public.video_guest_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  guest_name TEXT,
  guest_email TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_guest_tokens_token ON public.video_guest_tokens(token);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_session ON public.video_guest_tokens(session_id);

-- Enable RLS
ALTER TABLE public.video_guest_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for video_guest_tokens
CREATE POLICY "Providers can manage guest tokens for their sessions"
  ON public.video_guest_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.video_sessions vs
      JOIN public.providers p ON p.practice_id = vs.practice_id
      WHERE vs.id = video_guest_tokens.session_id
        AND p.user_id = auth.uid()
    )
  );

-- Public read for token validation (edge function will validate)
CREATE POLICY "Anyone can validate guest tokens"
  ON public.video_guest_tokens FOR SELECT
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate short room key
CREATE OR REPLACE FUNCTION generate_room_key()
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

-- Function to generate guest token
CREATE OR REPLACE FUNCTION generate_guest_token()
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

-- ============================================================================
-- ENABLE REALTIME FOR VIDEO TABLES
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_video_rooms;