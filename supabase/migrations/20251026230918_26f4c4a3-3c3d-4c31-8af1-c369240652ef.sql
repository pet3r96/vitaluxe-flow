-- Create pending_product_requests table
CREATE TABLE pending_product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Requester info
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL,
  
  -- Product details submitted by pharmacy
  name TEXT NOT NULL,
  dosage TEXT,
  sig TEXT,
  vitaluxe_price NUMERIC(10, 2) NOT NULL,
  product_type_id UUID REFERENCES product_types(id),
  product_type_name TEXT,
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  
  -- Admin fields (filled during review)
  base_price NUMERIC(10, 2),
  topline_price NUMERIC(10, 2),
  downline_price NUMERIC(10, 2),
  retail_price NUMERIC(10, 2),
  assigned_pharmacies UUID[],
  assigned_topline_reps UUID[],
  scope_type TEXT DEFAULT 'global',
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pending_product_requests_status ON pending_product_requests(status);
CREATE INDEX idx_pending_product_requests_pharmacy ON pending_product_requests(pharmacy_id);
CREATE INDEX idx_pending_product_requests_created_by ON pending_product_requests(created_by_user_id);

-- RLS Policies
ALTER TABLE pending_product_requests ENABLE ROW LEVEL SECURITY;

-- Pharmacies can insert their own requests
CREATE POLICY "Pharmacies can insert product requests"
  ON pending_product_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_user_id 
    AND has_role(auth.uid(), 'pharmacy')
    AND pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  );

-- Pharmacies can view their own requests
CREATE POLICY "Pharmacies can view own product requests"
  ON pending_product_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all product requests"
  ON pending_product_requests FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update requests (for review/approval)
CREATE POLICY "Admins can update product requests"
  ON pending_product_requests FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add new notification types for product requests
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'product_request_approved') THEN
    ALTER TYPE notification_type ADD VALUE 'product_request_approved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'product_request_rejected') THEN
    ALTER TYPE notification_type ADD VALUE 'product_request_rejected';
  END IF;
END $$;