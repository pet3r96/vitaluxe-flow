-- Create pharmacy_staff table for multi-user pharmacy access
CREATE TABLE public.pharmacy_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id uuid NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  role_type text NOT NULL DEFAULT 'staff',
  active boolean NOT NULL DEFAULT true,
  can_manage_orders boolean NOT NULL DEFAULT true,
  can_manage_shipping boolean NOT NULL DEFAULT true,
  can_view_api_config boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pharmacy_id)
);

-- Enable RLS
ALTER TABLE public.pharmacy_staff ENABLE ROW LEVEL SECURITY;

-- Indexes for fast lookups
CREATE INDEX idx_pharmacy_staff_user_id ON pharmacy_staff(user_id);
CREATE INDEX idx_pharmacy_staff_pharmacy_id ON pharmacy_staff(pharmacy_id);

-- RLS Policies for pharmacy_staff table

-- Admin full access
CREATE POLICY "admin_all_pharmacy_staff"
  ON pharmacy_staff FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pharmacy owner can manage their staff
CREATE POLICY "pharmacy_owner_manage_staff"
  ON pharmacy_staff FOR ALL
  USING (
    pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    pharmacy_id IN (
      SELECT id FROM pharmacies WHERE user_id = auth.uid()
    )
  );

-- Staff can view their own record
CREATE POLICY "pharmacy_staff_view_own"
  ON pharmacy_staff FOR SELECT
  USING (user_id = auth.uid());

-- Update pharmacies RLS to include staff access
DROP POLICY IF EXISTS "pharmacy_manage_own_record" ON pharmacies;

CREATE POLICY "pharmacy_manage_own_record"
  ON pharmacies FOR ALL
  USING (
    user_id = auth.uid() 
    OR id IN (
      SELECT pharmacy_id FROM pharmacy_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR id IN (
      SELECT pharmacy_id FROM pharmacy_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_pharmacy_staff_updated_at
  BEFORE UPDATE ON pharmacy_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();