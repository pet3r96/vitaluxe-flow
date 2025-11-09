-- Phase 1: Pharmacy API Integration Database Schema

-- 1.1 Extend pharmacies table with API configuration
ALTER TABLE pharmacies 
ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_endpoint_url TEXT,
ADD COLUMN IF NOT EXISTS api_auth_type TEXT CHECK (api_auth_type IN ('bearer', 'api_key', 'basic', 'none')),
ADD COLUMN IF NOT EXISTS api_auth_key_name TEXT,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS api_retry_count INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS api_timeout_seconds INTEGER DEFAULT 30;

COMMENT ON COLUMN pharmacies.api_enabled IS 'Whether this pharmacy uses custom API integration';
COMMENT ON COLUMN pharmacies.api_endpoint_url IS 'URL to POST new orders to';
COMMENT ON COLUMN pharmacies.api_auth_type IS 'Authentication type: bearer, api_key, basic, or none';
COMMENT ON COLUMN pharmacies.api_auth_key_name IS 'Header name for API key (e.g., X-API-Key, Authorization)';
COMMENT ON COLUMN pharmacies.webhook_url IS 'URL to fetch tracking updates from (polled hourly)';
COMMENT ON COLUMN pharmacies.webhook_secret IS 'Secret key for validating incoming webhooks from pharmacy';
COMMENT ON COLUMN pharmacies.api_retry_count IS 'Number of retry attempts for failed API calls';
COMMENT ON COLUMN pharmacies.api_timeout_seconds IS 'Timeout in seconds for API calls';

-- 1.2 Create pharmacy API credentials table (for encrypted storage)
CREATE TABLE IF NOT EXISTS pharmacy_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  credential_key TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key', 'bearer_token', 'basic_auth_username', 'basic_auth_password')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pharmacy_id, credential_type)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_api_credentials_pharmacy ON pharmacy_api_credentials(pharmacy_id);

ALTER TABLE pharmacy_api_credentials ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage pharmacy API credentials
CREATE POLICY "Admins can manage pharmacy API credentials"
ON pharmacy_api_credentials
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.3 Create order API transmission log
CREATE TABLE IF NOT EXISTS pharmacy_order_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES order_lines(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  transmission_type TEXT NOT NULL CHECK (transmission_type IN ('new_order', 'cancellation', 'update')),
  api_endpoint TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_status INTEGER,
  response_body JSONB,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  transmitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_transmissions_order ON pharmacy_order_transmissions(order_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_transmissions_pharmacy ON pharmacy_order_transmissions(pharmacy_id, transmitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_transmissions_success ON pharmacy_order_transmissions(success, transmitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_transmissions_order_line ON pharmacy_order_transmissions(order_line_id);

ALTER TABLE pharmacy_order_transmissions ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can view all, pharmacies can view their own
CREATE POLICY "Admins can view all pharmacy transmissions"
ON pharmacy_order_transmissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can view their own transmissions"
ON pharmacy_order_transmissions
FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) 
  AND pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())
);

-- 1.4 Create pharmacy tracking updates table
CREATE TABLE IF NOT EXISTS pharmacy_tracking_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  tracking_number TEXT,
  carrier TEXT,
  status TEXT NOT NULL,
  status_details TEXT,
  location TEXT,
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  raw_tracking_data JSONB,
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_tracking_order_line ON pharmacy_tracking_updates(order_line_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tracking_pharmacy ON pharmacy_tracking_updates(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_tracking_number ON pharmacy_tracking_updates(tracking_number);

ALTER TABLE pharmacy_tracking_updates ENABLE ROW LEVEL SECURITY;

-- RLS: Admins, pharmacies, and order owners can view tracking
CREATE POLICY "Admins can view all tracking updates"
ON pharmacy_tracking_updates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can view their own tracking updates"
ON pharmacy_tracking_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) 
  AND pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())
);

CREATE POLICY "Doctors can view tracking for their orders"
ON pharmacy_tracking_updates
FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND order_line_id IN (
    SELECT ol.id FROM order_lines ol
    INNER JOIN orders o ON ol.order_id = o.id
    WHERE o.doctor_id = auth.uid()
  )
);