-- Fix case sensitivity bug and backfill jobs for Demo Pharmacy 1
-- Step 1: Update trigger to use case-insensitive email comparison
CREATE OR REPLACE FUNCTION public.enqueue_pharmacy_order_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enqueue when payment_status changes to 'paid'
  IF OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.payment_status = 'paid' THEN
    -- Create one job per order_line with assigned pharmacy AND matching email (case-insensitive)
    INSERT INTO pharmacy_order_jobs (order_id, order_line_id, pharmacy_id, status, max_attempts)
    SELECT 
      NEW.id,
      ol.id,
      ol.assigned_pharmacy_id,
      'pending',
      3
    FROM order_lines ol
    INNER JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
    WHERE ol.order_id = NEW.id
      AND ol.assigned_pharmacy_id IS NOT NULL
      AND LOWER(ph.contact_email) = 'dsporn00@yahoo.com'
    ON CONFLICT (order_line_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 2: Backfill jobs for existing paid orders assigned to Demo Pharmacy 1
INSERT INTO pharmacy_order_jobs (order_id, order_line_id, pharmacy_id, status, max_attempts)
SELECT 
  ol.order_id,
  ol.id,
  ol.assigned_pharmacy_id,
  'pending',
  3
FROM order_lines ol
JOIN orders o ON o.id = ol.order_id
JOIN pharmacies ph ON ph.id = ol.assigned_pharmacy_id
WHERE o.payment_status = 'paid'
  AND ol.assigned_pharmacy_id IS NOT NULL
  AND LOWER(ph.contact_email) = 'dsporn00@yahoo.com'
  AND NOT EXISTS (
    SELECT 1 FROM pharmacy_order_jobs poj 
    WHERE poj.order_line_id = ol.id
  )
ON CONFLICT (order_line_id) DO NOTHING;