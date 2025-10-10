-- Create shipping_carrier enum type
CREATE TYPE shipping_carrier AS ENUM ('fedex', 'ups', 'usps', 'dhl', 'other');

-- Add shipping_carrier column to order_lines table
ALTER TABLE order_lines
ADD COLUMN shipping_carrier shipping_carrier DEFAULT 'other';

-- Create shipping_audit_logs table
CREATE TABLE shipping_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID REFERENCES order_lines(id) ON DELETE CASCADE NOT NULL,
  updated_by UUID REFERENCES profiles(id) NOT NULL,
  updated_by_role app_role NOT NULL,
  old_tracking_number TEXT,
  new_tracking_number TEXT,
  old_carrier shipping_carrier,
  new_carrier shipping_carrier,
  old_status order_status,
  new_status order_status,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on shipping_audit_logs
ALTER TABLE shipping_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON shipping_audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Pharmacies can view audit logs for their assigned order lines
CREATE POLICY "Pharmacies can view their audit logs"
ON shipping_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ol.id = order_line_id 
    AND ph.user_id = auth.uid()
    AND has_role(auth.uid(), 'pharmacy')
  )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON shipping_audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = updated_by);