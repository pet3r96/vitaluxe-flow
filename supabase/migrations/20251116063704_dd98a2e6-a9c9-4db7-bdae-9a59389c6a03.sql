-- Create practice_development_fees table (without FK to practices for now)
CREATE TABLE IF NOT EXISTS practice_development_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid NOT NULL,
  topline_rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  monthly_amount numeric NOT NULL,
  effective_from date NOT NULL,
  effective_until date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to pending tables
ALTER TABLE pending_product_requests 
ADD COLUMN IF NOT EXISTS dosage text,
ADD COLUMN IF NOT EXISTS vitaluxe_price numeric,
ADD COLUMN IF NOT EXISTS product_type_name text,
ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now();

ALTER TABLE pending_reps
ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS admin_notes text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE pending_practices
ADD COLUMN IF NOT EXISTS license_number text,
ADD COLUMN IF NOT EXISTS dea text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_zip text,
ADD COLUMN IF NOT EXISTS address_formatted text,
ADD COLUMN IF NOT EXISTS address_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS address_verification_status text,
ADD COLUMN IF NOT EXISTS address_verification_source text;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_practice_dev_fees_practice ON practice_development_fees(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_dev_fees_rep ON practice_development_fees(topline_rep_id);
CREATE INDEX IF NOT EXISTS idx_practice_dev_fees_active ON practice_development_fees(active);

-- Enable RLS
ALTER TABLE practice_development_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all development fees"
  ON practice_development_fees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Reps can view their own development fees"
  ON practice_development_fees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reps
      WHERE reps.id = practice_development_fees.topline_rep_id
      AND reps.user_id = auth.uid()
    )
  );