-- Add environment support and OAuth token fields to pharmacies
ALTER TABLE public.pharmacies 
ADD COLUMN IF NOT EXISTS api_environment TEXT DEFAULT 'sandbox' CHECK (api_environment IN ('sandbox', 'production')),
ADD COLUMN IF NOT EXISTS api_token_endpoint_url TEXT,
ADD COLUMN IF NOT EXISTS api_sandbox_endpoint_url TEXT,
ADD COLUMN IF NOT EXISTS api_production_endpoint_url TEXT,
ADD COLUMN IF NOT EXISTS api_client_id TEXT,
ADD COLUMN IF NOT EXISTS api_client_secret_encrypted TEXT;

-- Create pharmacy API token cache table
CREATE TABLE IF NOT EXISTS public.pharmacy_api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, environment)
);

-- Create idempotency keys table for preventing duplicate submissions
CREATE TABLE IF NOT EXISTS public.pharmacy_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_line_id UUID,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  pharmacy_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(idempotency_key, pharmacy_id)
);

-- Enable RLS on new tables
ALTER TABLE public.pharmacy_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for pharmacy_api_tokens (admin only)
CREATE POLICY "Admins can manage pharmacy tokens"
  ON public.pharmacy_api_tokens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS policies for pharmacy_idempotency_keys (admin and pharmacy)
CREATE POLICY "Admins can view idempotency keys"
  ON public.pharmacy_idempotency_keys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.pharmacies WHERE id = pharmacy_id AND user_id = auth.uid())
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_api_tokens_pharmacy_env 
  ON public.pharmacy_api_tokens(pharmacy_id, environment);
CREATE INDEX IF NOT EXISTS idx_pharmacy_api_tokens_expires 
  ON public.pharmacy_api_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_pharmacy_idempotency_order 
  ON public.pharmacy_idempotency_keys(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_idempotency_key_pharmacy 
  ON public.pharmacy_idempotency_keys(idempotency_key, pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_idempotency_expires 
  ON public.pharmacy_idempotency_keys(expires_at);

-- Trigger to update updated_at on pharmacy_api_tokens
CREATE OR REPLACE FUNCTION public.update_pharmacy_api_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pharmacy_api_tokens_updated_at ON public.pharmacy_api_tokens;
CREATE TRIGGER tr_pharmacy_api_tokens_updated_at
  BEFORE UPDATE ON public.pharmacy_api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pharmacy_api_tokens_updated_at();

-- Function to clean up expired idempotency keys (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.pharmacy_idempotency_keys
  WHERE expires_at < now() AND status IN ('completed', 'failed');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;