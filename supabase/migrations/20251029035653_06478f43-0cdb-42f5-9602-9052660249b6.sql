-- Create calendar_sync_tokens table for secure calendar feed URLs
CREATE TABLE public.calendar_sync_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own sync tokens
CREATE POLICY "Users can view own sync tokens"
  ON public.calendar_sync_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync tokens"
  ON public.calendar_sync_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sync tokens"
  ON public.calendar_sync_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync tokens"
  ON public.calendar_sync_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all sync tokens
CREATE POLICY "Admins can view all sync tokens"
  ON public.calendar_sync_tokens
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster token lookups
CREATE INDEX idx_calendar_sync_tokens_token ON public.calendar_sync_tokens(token) WHERE is_active = true;
CREATE INDEX idx_calendar_sync_tokens_user_id ON public.calendar_sync_tokens(user_id);