-- Fix Rx pricing trigger to allow admin markup on practice price
CREATE OR REPLACE FUNCTION public.enforce_rx_pricing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requires_prescription = true THEN
    -- Clear rep prices (federal anti-kickback compliance)
    NEW.topline_price := NULL;
    NEW.downline_price := NULL;
    -- Allow admin to set practice price above base price
    -- (retail_price can be > base_price, admin earns 100% of markup)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;