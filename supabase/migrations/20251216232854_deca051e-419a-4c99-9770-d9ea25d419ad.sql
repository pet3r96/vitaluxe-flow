-- Add new columns to pharmacies table for per-pharmacy API customization

-- API handler type (generic, baremeds, custom)
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS api_handler_type TEXT DEFAULT 'generic';

-- HTTP method for API calls
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS api_http_method TEXT DEFAULT 'POST';

-- Custom payload template for mapping order data to pharmacy-specific format
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS api_payload_template JSONB;

-- Additional custom headers beyond authentication
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS api_custom_headers JSONB;

-- Inbound webhook configuration
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS inbound_webhook_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS inbound_webhook_path TEXT;
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Status mapping from pharmacy-specific statuses to our standard statuses
ALTER TABLE public.pharmacies ADD COLUMN IF NOT EXISTS api_status_mapping JSONB;

-- Add unique constraint on inbound_webhook_path (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pharmacies_inbound_webhook_path 
ON public.pharmacies (inbound_webhook_path) 
WHERE inbound_webhook_path IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.pharmacies.api_handler_type IS 'Type of API handler: generic, baremeds, or custom handler name';
COMMENT ON COLUMN public.pharmacies.api_http_method IS 'HTTP method for outbound API calls: POST, PUT, PATCH';
COMMENT ON COLUMN public.pharmacies.api_payload_template IS 'JSON template for transforming order data to pharmacy format';
COMMENT ON COLUMN public.pharmacies.api_custom_headers IS 'Additional HTTP headers to include in API requests';
COMMENT ON COLUMN public.pharmacies.inbound_webhook_enabled IS 'Whether this pharmacy can send webhooks to us';
COMMENT ON COLUMN public.pharmacies.inbound_webhook_path IS 'Unique path segment for routing inbound webhooks';
COMMENT ON COLUMN public.pharmacies.webhook_secret IS 'Secret key for validating inbound webhook signatures';
COMMENT ON COLUMN public.pharmacies.api_status_mapping IS 'Map pharmacy status codes to our standard order statuses';