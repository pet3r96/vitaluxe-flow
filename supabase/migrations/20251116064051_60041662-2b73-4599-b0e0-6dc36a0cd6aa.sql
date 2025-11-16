-- Add missing columns to pending_practices
ALTER TABLE pending_practices
  ADD COLUMN IF NOT EXISTS contract_file text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Add missing columns to rep_product_price_overrides
ALTER TABLE rep_product_price_overrides
  ADD COLUMN IF NOT EXISTS override_topline_price numeric,
  ADD COLUMN IF NOT EXISTS override_downline_price numeric,
  ADD COLUMN IF NOT EXISTS override_retail_price numeric;

-- Add foreign key for pending_product_requests to product_types
ALTER TABLE pending_product_requests
  ADD COLUMN IF NOT EXISTS product_type_id uuid REFERENCES product_types(id);

-- Create sms_codes table
CREATE TABLE IF NOT EXISTS sms_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone text NOT NULL,
  code text NOT NULL,
  verified boolean DEFAULT false,
  attempt_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz
);

-- Create two_fa_audit_log table
CREATE TABLE IF NOT EXISTS two_fa_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone);
CREATE INDEX IF NOT EXISTS idx_two_fa_audit_user ON two_fa_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_products_type ON pending_product_requests(product_type_id);

-- Enable RLS
ALTER TABLE sms_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE two_fa_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for sms_codes
CREATE POLICY "Users can view their own SMS codes"
  ON sms_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all SMS codes"
  ON sms_codes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert SMS codes"
  ON sms_codes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update SMS codes"
  ON sms_codes FOR UPDATE
  USING (true);

-- RLS policies for two_fa_audit_log
CREATE POLICY "Users can view their own 2FA audit logs"
  ON two_fa_audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all 2FA audit logs"
  ON two_fa_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert 2FA audit logs"
  ON two_fa_audit_log FOR INSERT
  WITH CHECK (true);