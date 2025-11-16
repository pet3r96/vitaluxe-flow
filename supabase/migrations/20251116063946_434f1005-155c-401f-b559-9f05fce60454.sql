-- Create product_types table if not exists
CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text,
  requires_prescription boolean DEFAULT false,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create rep_product_price_overrides table if not exists
CREATE TABLE IF NOT EXISTS rep_product_price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  override_price numeric NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to pending_practices
ALTER TABLE pending_practices 
  ADD COLUMN IF NOT EXISTS prescriber_full_name text,
  ADD COLUMN IF NOT EXISTS prescriber_name text,
  ADD COLUMN IF NOT EXISTS prescriber_npi text,
  ADD COLUMN IF NOT EXISTS prescriber_dea text,
  ADD COLUMN IF NOT EXISTS prescriber_license text,
  ADD COLUMN IF NOT EXISTS prescriber_email text,
  ADD COLUMN IF NOT EXISTS prescriber_phone text,
  ADD COLUMN IF NOT EXISTS prescriber_specialty text,
  ADD COLUMN IF NOT EXISTS prescriber_state text;

-- Add missing columns to practice_development_fee_invoices
ALTER TABLE practice_development_fee_invoices
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_product_types_name ON product_types(name);
CREATE INDEX IF NOT EXISTS idx_rep_price_overrides_rep ON rep_product_price_overrides(rep_user_id);
CREATE INDEX IF NOT EXISTS idx_rep_price_overrides_product ON rep_product_price_overrides(product_id);

-- Enable RLS
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_product_price_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view active product types" ON product_types;
  DROP POLICY IF EXISTS "Admins can manage product types" ON product_types;
  DROP POLICY IF EXISTS "Reps can view their own overrides" ON rep_product_price_overrides;
  DROP POLICY IF EXISTS "Admins can manage all overrides" ON rep_product_price_overrides;
END $$;

-- RLS policies for product_types
CREATE POLICY "Anyone can view active product types"
  ON product_types FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage product types"
  ON product_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- RLS policies for rep_product_price_overrides
CREATE POLICY "Reps can view their own overrides"
  ON rep_product_price_overrides FOR SELECT
  USING (rep_user_id = auth.uid());

CREATE POLICY "Admins can manage all overrides"
  ON rep_product_price_overrides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );