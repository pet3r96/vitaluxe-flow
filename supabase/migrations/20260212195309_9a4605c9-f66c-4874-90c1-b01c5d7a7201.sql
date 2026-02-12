ALTER TABLE pending_product_requests
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS request_source text NOT NULL DEFAULT 'pharmacy',
  ADD COLUMN IF NOT EXISTS practice_id uuid REFERENCES profiles(id);