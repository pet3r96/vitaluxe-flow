-- Create system_settings table for configurable settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage settings
CREATE POLICY "Admins can manage system settings"
  ON public.system_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read settings (needed for calculating fees)
CREATE POLICY "All authenticated users can read settings"
  ON public.system_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert default merchant fee setting
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'merchant_processing_fee_percentage',
  '3.75'::jsonb,
  'Merchant processing fee percentage applied to order total (subtotal + shipping)'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- Add merchant fee columns to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS merchant_fee_amount numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS merchant_fee_percentage numeric(5, 2) DEFAULT 0;

COMMENT ON COLUMN public.orders.merchant_fee_amount IS 'Merchant processing fee charged on this order';
COMMENT ON COLUMN public.orders.merchant_fee_percentage IS 'Percentage used to calculate merchant fee at time of order';