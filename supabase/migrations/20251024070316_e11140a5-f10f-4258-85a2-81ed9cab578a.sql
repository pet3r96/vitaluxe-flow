-- Create temp_password_tokens table for direct password change from email
CREATE TABLE IF NOT EXISTS public.temp_password_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_token ON public.temp_password_tokens(token);
CREATE INDEX IF NOT EXISTS idx_temp_password_tokens_user_id ON public.temp_password_tokens(user_id);

-- Enable RLS
ALTER TABLE public.temp_password_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can view tokens (for debugging purposes)
CREATE POLICY "Admins can view all temp password tokens"
  ON public.temp_password_tokens
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));