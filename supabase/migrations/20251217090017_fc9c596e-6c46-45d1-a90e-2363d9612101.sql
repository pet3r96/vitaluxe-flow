-- Add vios_service_code column to pharmacy_shipping_rates
-- This stores the VIOS-specific shipping service code (1=ground, 2=2day, 3=overnight, 4=priority)
ALTER TABLE public.pharmacy_shipping_rates 
ADD COLUMN IF NOT EXISTS vios_service_code integer;

-- Add comment explaining the codes
COMMENT ON COLUMN public.pharmacy_shipping_rates.vios_service_code IS 
'VIOS API shipping service code: 1=ground, 2=2day, 3=overnight (requires VIOS account config), 4=priority';

-- Update existing Vios Compounding rates with default service codes
UPDATE public.pharmacy_shipping_rates 
SET vios_service_code = CASE 
  WHEN shipping_speed = 'ground' THEN 1
  WHEN shipping_speed = '2day' THEN 2
  WHEN shipping_speed = 'overnight' THEN 3
  ELSE NULL
END
WHERE pharmacy_id IN (
  SELECT id FROM public.pharmacies WHERE api_handler_type = 'vios'
);

-- Create or replace function to auto-enable VIOS API when pharmacy is assigned to a product
CREATE OR REPLACE FUNCTION public.auto_enable_vios_api_on_product_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the assigned pharmacy is a VIOS pharmacy
  UPDATE public.pharmacies
  SET api_enabled = true
  WHERE id = NEW.pharmacy_id
    AND api_handler_type = 'vios'
    AND api_enabled = false;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-enable VIOS API when product is assigned
DROP TRIGGER IF EXISTS trigger_auto_enable_vios_api ON public.product_pharmacies;
CREATE TRIGGER trigger_auto_enable_vios_api
  AFTER INSERT ON public.product_pharmacies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enable_vios_api_on_product_assignment();