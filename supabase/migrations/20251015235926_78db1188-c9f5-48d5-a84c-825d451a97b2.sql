-- Create enum for verification code types
CREATE TYPE verification_code_type AS ENUM ('2fa_setup', '2fa_login');

-- Table 1: User 2FA Settings
CREATE TABLE public.user_2fa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  phone_verified boolean DEFAULT false NOT NULL,
  phone_verified_at timestamp with time zone,
  is_enrolled boolean DEFAULT false NOT NULL,
  enrolled_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  reset_requested_by uuid REFERENCES auth.users(id),
  reset_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on user_2fa_settings
ALTER TABLE public.user_2fa_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_2fa_settings
CREATE POLICY "Users can view own 2FA settings"
  ON public.user_2fa_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own 2FA settings"
  ON public.user_2fa_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA settings"
  ON public.user_2fa_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all 2FA settings"
  ON public.user_2fa_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all 2FA settings"
  ON public.user_2fa_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_user_2fa_settings_updated_at
  BEFORE UPDATE ON public.user_2fa_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Table 2: 2FA Verification Codes
CREATE TABLE public.two_fa_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  code text NOT NULL,
  code_type verification_code_type NOT NULL DEFAULT '2fa_setup',
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false NOT NULL,
  verified_at timestamp with time zone,
  attempts integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on two_fa_verification_codes
ALTER TABLE public.two_fa_verification_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for two_fa_verification_codes
CREATE POLICY "Users can view own codes"
  ON public.two_fa_verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert codes"
  ON public.two_fa_verification_codes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update codes"
  ON public.two_fa_verification_codes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Index for cleanup
CREATE INDEX idx_2fa_codes_expires_at ON public.two_fa_verification_codes(expires_at);
CREATE INDEX idx_2fa_codes_user_id ON public.two_fa_verification_codes(user_id);

-- Table 3: 2FA Reset Logs (Audit Trail)
CREATE TABLE public.two_fa_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email text NOT NULL,
  reset_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  reset_by_email text NOT NULL,
  reason text,
  previous_phone_number text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on two_fa_reset_logs
ALTER TABLE public.two_fa_reset_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for two_fa_reset_logs
CREATE POLICY "Admins can view 2FA reset logs"
  ON public.two_fa_reset_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert 2FA reset logs"
  ON public.two_fa_reset_logs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));