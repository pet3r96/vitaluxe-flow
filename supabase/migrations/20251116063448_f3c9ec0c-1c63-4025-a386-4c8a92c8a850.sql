-- Add payment_status column to practice_development_fee_invoices
ALTER TABLE practice_development_fee_invoices 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- Create order_status_configs table
CREATE TABLE IF NOT EXISTS order_status_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  color_class text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_system_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_order_status_configs_status_key ON order_status_configs(status_key);
CREATE INDEX IF NOT EXISTS idx_order_status_configs_sort_order ON order_status_configs(sort_order);

-- Enable RLS
ALTER TABLE order_status_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_status_configs
CREATE POLICY "Anyone can view order status configs"
  ON order_status_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage order status configs"
  ON order_status_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );