-- Create pending_reps table
CREATE TABLE pending_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Requester info
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_role app_role NOT NULL,
  
  -- Pending rep details
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  role app_role NOT NULL CHECK (role IN ('topline', 'downline')),
  
  -- For downlines: assign to requesting topline
  assigned_topline_user_id UUID REFERENCES auth.users(id),
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pending_reps
CREATE INDEX idx_pending_reps_status ON pending_reps(status);
CREATE INDEX idx_pending_reps_created_by ON pending_reps(created_by_user_id);
CREATE INDEX idx_pending_reps_email ON pending_reps(email);

-- RLS Policies for pending_reps
ALTER TABLE pending_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can insert pending rep requests"
  ON pending_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_user_id 
    AND (
      has_role(auth.uid(), 'topline') 
      OR has_role(auth.uid(), 'downline')
    )
  );

CREATE POLICY "Reps can view own pending rep requests"
  ON pending_reps FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Admins can view all pending rep requests"
  ON pending_reps FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending rep requests"
  ON pending_reps FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on pending_reps
CREATE TRIGGER update_pending_reps_updated_at
  BEFORE UPDATE ON pending_reps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create pending_practices table
CREATE TABLE pending_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Requester info (topline or downline rep)
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_role app_role NOT NULL CHECK (created_by_role IN ('topline', 'downline')),
  
  -- Practice details
  practice_name TEXT NOT NULL,
  email TEXT NOT NULL,
  npi TEXT NOT NULL,
  license_number TEXT NOT NULL,
  dea TEXT,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Address
  address_street TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_state TEXT NOT NULL,
  address_zip TEXT NOT NULL,
  
  -- Prescriber info
  prescriber_full_name TEXT NOT NULL,
  prescriber_name TEXT NOT NULL,
  prescriber_npi TEXT NOT NULL,
  prescriber_dea TEXT,
  prescriber_license TEXT NOT NULL,
  prescriber_phone TEXT,
  
  -- Contract file (stored as JSON with base64 data)
  contract_file JSONB,
  
  -- Assignment (will be rep's user_id)
  assigned_rep_user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for pending_practices
CREATE INDEX idx_pending_practices_status ON pending_practices(status);
CREATE INDEX idx_pending_practices_created_by ON pending_practices(created_by_user_id);
CREATE INDEX idx_pending_practices_email ON pending_practices(email);

-- RLS Policies for pending_practices
ALTER TABLE pending_practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can insert pending practice requests"
  ON pending_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_user_id 
    AND (
      has_role(auth.uid(), 'topline') 
      OR has_role(auth.uid(), 'downline')
    )
  );

CREATE POLICY "Reps can view own pending practice requests"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "Toplines can view downline practice requests"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'topline')
    AND assigned_rep_user_id IN (
      SELECT user_id FROM reps r
      WHERE r.assigned_topline_id IN (
        SELECT id FROM reps WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can view all pending practice requests"
  ON pending_practices FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pending practice requests"
  ON pending_practices FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on pending_practices
CREATE TRIGGER update_pending_practices_updated_at
  BEFORE UPDATE ON pending_practices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();