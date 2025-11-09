-- Add retry tracking columns to pharmacy_order_transmissions
ALTER TABLE pharmacy_order_transmissions 
ADD COLUMN manually_retried BOOLEAN DEFAULT false,
ADD COLUMN retried_at TIMESTAMPTZ,
ADD COLUMN retried_by UUID REFERENCES auth.users(id);

-- Create admin alerts table
CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('pharmacy_api_down', 'missing_tracking_updates', 'high_failure_rate')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for admin_alerts
CREATE INDEX idx_admin_alerts_unresolved ON admin_alerts(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_admin_alerts_pharmacy ON admin_alerts(pharmacy_id, created_at DESC);
CREATE INDEX idx_admin_alerts_type ON admin_alerts(alert_type);

-- RLS policies for admin_alerts
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts"
ON admin_alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can insert alerts"
ON admin_alerts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can update alerts"
ON admin_alerts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);