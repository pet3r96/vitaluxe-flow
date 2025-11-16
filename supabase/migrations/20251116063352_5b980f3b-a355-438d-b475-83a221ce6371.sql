-- Create admin_ip_banlist table for IP banning
CREATE TABLE IF NOT EXISTS admin_ip_banlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL UNIQUE,
  description text,
  banned_reason text NOT NULL,
  banned boolean NOT NULL DEFAULT true,
  banned_by uuid NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create practice_development_fee_invoices table
CREATE TABLE IF NOT EXISTS practice_development_fee_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  topline_rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  billing_month text NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  invoice_template_data jsonb,
  status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_ip_banlist_ip ON admin_ip_banlist(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_ip_banlist_banned ON admin_ip_banlist(banned);
CREATE INDEX IF NOT EXISTS idx_practice_dev_fee_invoices_rep ON practice_development_fee_invoices(topline_rep_id);
CREATE INDEX IF NOT EXISTS idx_practice_dev_fee_invoices_status ON practice_development_fee_invoices(status);

-- Enable RLS
ALTER TABLE admin_ip_banlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_development_fee_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_ip_banlist
CREATE POLICY "Admins can manage IP banlist"
  ON admin_ip_banlist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for practice_development_fee_invoices
CREATE POLICY "Admins can manage all invoices"
  ON practice_development_fee_invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Reps can view their own invoices"
  ON practice_development_fee_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reps
      WHERE reps.id = practice_development_fee_invoices.topline_rep_id
      AND reps.user_id = auth.uid()
    )
  );