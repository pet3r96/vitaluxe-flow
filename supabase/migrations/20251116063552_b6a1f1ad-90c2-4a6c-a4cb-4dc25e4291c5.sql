-- Create pending_practices table
CREATE TABLE IF NOT EXISTS pending_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL,
  created_by_role text NOT NULL,
  assigned_rep_user_id uuid,
  practice_name text NOT NULL,
  npi text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  website text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create pending_product_requests table
CREATE TABLE IF NOT EXISTS pending_product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL,
  pharmacy_id uuid REFERENCES pharmacies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  ndc text,
  unit_price numeric,
  category text,
  requires_prescription boolean DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_practices_created_by ON pending_practices(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_practices_status ON pending_practices(status);
CREATE INDEX IF NOT EXISTS idx_pending_practices_assigned_rep ON pending_practices(assigned_rep_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_product_requests_created_by ON pending_product_requests(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_product_requests_pharmacy ON pending_product_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_pending_product_requests_status ON pending_product_requests(status);

-- Enable RLS
ALTER TABLE pending_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_product_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pending_practices
CREATE POLICY "Users can view their own pending practices"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can insert their own pending practices"
  ON pending_practices FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Admins can view all pending practices"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update pending practices"
  ON pending_practices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Reps can view their assigned pending practices"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (
    assigned_rep_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('topline', 'downline')
    )
  );

-- RLS Policies for pending_product_requests
CREATE POLICY "Users can view their own pending product requests"
  ON pending_product_requests FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can insert their own pending product requests"
  ON pending_product_requests FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Admins can view all pending product requests"
  ON pending_product_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update pending product requests"
  ON pending_product_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );