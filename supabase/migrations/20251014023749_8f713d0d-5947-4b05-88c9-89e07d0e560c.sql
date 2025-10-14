-- Create account lockouts table for tracking locked accounts/IPs
CREATE TABLE public.account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  ip_address TEXT,
  lockout_reason TEXT NOT NULL, -- 'brute_force', 'manual', 'suspicious_activity'
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  locked_until TIMESTAMP WITH TIME ZONE, -- NULL = permanent until admin unlocks
  unlocked_at TIMESTAMP WITH TIME ZONE,
  unlocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_account_lockouts_user_email ON public.account_lockouts(user_email);
CREATE INDEX idx_account_lockouts_ip_address ON public.account_lockouts(ip_address);
CREATE INDEX idx_account_lockouts_locked_at ON public.account_lockouts(locked_at DESC);

-- RLS
ALTER TABLE public.account_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all lockouts"
ON public.account_lockouts
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert lockouts"
ON public.account_lockouts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update lockouts"
ON public.account_lockouts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));