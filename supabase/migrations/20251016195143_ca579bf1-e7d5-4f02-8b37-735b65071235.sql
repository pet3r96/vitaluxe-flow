-- Create order status configurations table
CREATE TABLE IF NOT EXISTS order_status_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  color_class TEXT NOT NULL,
  icon_name TEXT,
  is_system_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create order status history table for audit trail
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id) NOT NULL,
  changed_by_role app_role NOT NULL,
  change_reason TEXT,
  is_manual_override BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add manual override columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS status_manual_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_override_reason TEXT;

-- Seed default status configurations
INSERT INTO order_status_configs (status_key, display_name, description, color_class, sort_order, is_system_default) VALUES
('pending', 'Pending', 'Order received, awaiting processing', 'bg-muted text-muted-foreground', 1, true),
('processing', 'Processing', 'Order is being fulfilled', 'bg-primary text-primary-foreground', 2, true),
('filled', 'Filled', 'Order has been filled by pharmacy', 'bg-blue-500 text-white', 3, true),
('shipped', 'Shipped', 'Order has been shipped', 'bg-secondary text-secondary-foreground', 4, true),
('delivered', 'Delivered', 'Order has been delivered', 'bg-accent text-accent-foreground', 5, true),
('completed', 'Completed', 'Order fully completed', 'bg-green-500 text-white', 6, true),
('denied', 'Denied', 'Order or items denied', 'bg-destructive text-destructive-foreground', 7, true),
('cancelled', 'Cancelled', 'Order cancelled', 'bg-destructive text-destructive-foreground', 8, true),
('on_hold', 'On Hold', 'Order temporarily on hold', 'bg-amber-500 text-white', 9, false)
ON CONFLICT (status_key) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE order_status_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_status_configs
CREATE POLICY "Everyone can view active status configs"
  ON order_status_configs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage status configs"
  ON order_status_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for order_status_history
CREATE POLICY "Admins can view all status history"
  ON order_status_history FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Doctors can view their order status history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_status_history.order_id
        AND orders.doctor_id = auth.uid()
    )
  );

CREATE POLICY "Pharmacies can view assigned order status history"
  ON order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN order_lines ol ON ol.order_id = o.id
      JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
      WHERE o.id = order_status_history.order_id
        AND ph.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert status history"
  ON order_status_history FOR INSERT
  WITH CHECK (true);

-- Update the update_order_status trigger function to respect manual overrides
CREATE OR REPLACE FUNCTION public.update_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Skip auto-calculation if manual override is set
  IF (SELECT status_manual_override FROM orders WHERE id = NEW.order_id) = true THEN
    RETURN NEW;
  END IF;

  WITH line_statuses AS (
    SELECT 
      order_id,
      COUNT(*) AS total_lines,
      COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count,
      COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_count,
      COUNT(*) FILTER (WHERE status = 'denied') AS denied_count,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'filled') AS filled_count
    FROM order_lines
    WHERE order_id = NEW.order_id
    GROUP BY order_id
  )
  UPDATE orders o
  SET 
    status = CASE
      WHEN o.status = 'cancelled' THEN 'cancelled'
      WHEN ls.delivered_count = ls.total_lines THEN 'completed'
      WHEN ls.denied_count = ls.total_lines THEN 'denied'
      WHEN ls.shipped_count = ls.total_lines THEN 'shipped'
      WHEN ls.filled_count > 0 
        OR ls.shipped_count > 0 
        OR ls.delivered_count > 0
        OR (ls.denied_count > 0 AND ls.denied_count < ls.total_lines) THEN 'processing'
      ELSE 'pending'
    END,
    updated_at = now()
  FROM line_statuses ls
  WHERE o.id = NEW.order_id;

  RETURN NEW;
END;
$function$;