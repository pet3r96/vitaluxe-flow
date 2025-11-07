-- Create video session guest links table
CREATE TABLE IF NOT EXISTS public.video_session_guest_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.video_sessions(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  accessed_by_ip TEXT,
  is_revoked BOOLEAN DEFAULT false,
  max_uses INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_video_guest_links_session_id ON public.video_session_guest_links(session_id);
CREATE INDEX IF NOT EXISTS idx_video_guest_links_token ON public.video_session_guest_links(token);
CREATE INDEX IF NOT EXISTS idx_video_guest_links_expires_at ON public.video_session_guest_links(expires_at);

-- Enable RLS
ALTER TABLE public.video_session_guest_links ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view their practice's session guest links
CREATE POLICY "Staff can view session guest links"
  ON public.video_session_guest_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.video_sessions vs
      WHERE vs.id = session_id
        AND vs.practice_id IN (
          SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
          UNION
          SELECT id FROM public.profiles WHERE id = auth.uid() AND has_role(auth.uid(), 'doctor'::app_role)
        )
    )
  );

-- Policy: Staff can create guest links for their practice's sessions
CREATE POLICY "Staff can create session guest links"
  ON public.video_session_guest_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.video_sessions vs
      WHERE vs.id = session_id
        AND vs.practice_id IN (
          SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
          UNION
          SELECT id FROM public.profiles WHERE id = auth.uid() AND has_role(auth.uid(), 'doctor'::app_role)
        )
    )
  );

-- Policy: Staff can update (revoke) their practice's guest links
CREATE POLICY "Staff can update session guest links"
  ON public.video_session_guest_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.video_sessions vs
      WHERE vs.id = session_id
        AND vs.practice_id IN (
          SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
          UNION
          SELECT id FROM public.profiles WHERE id = auth.uid() AND has_role(auth.uid(), 'doctor'::app_role)
        )
    )
  );