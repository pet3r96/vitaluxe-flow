-- Create pharmacy_order_jobs table for queue processing
CREATE TABLE pharmacy_order_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_line_id UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'max_retries_exceeded')),
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  baremeds_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(order_line_id)
);

CREATE INDEX idx_pharmacy_order_jobs_status ON pharmacy_order_jobs(status);
CREATE INDEX idx_pharmacy_order_jobs_created_at ON pharmacy_order_jobs(created_at);

-- Enable RLS
ALTER TABLE pharmacy_order_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can view all jobs
CREATE POLICY "Admins can view all pharmacy order jobs"
ON pharmacy_order_jobs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can manage jobs
CREATE POLICY "System can manage pharmacy order jobs"
ON pharmacy_order_jobs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create trigger function to enqueue jobs when payment_status changes to 'paid'
CREATE OR REPLACE FUNCTION enqueue_pharmacy_order_jobs()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when payment_status changes from non-paid to paid
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Insert a job for each order line that has an assigned pharmacy
    INSERT INTO pharmacy_order_jobs (order_id, order_line_id, pharmacy_id)
    SELECT 
      NEW.id,
      ol.id,
      ol.assigned_pharmacy_id
    FROM order_lines ol
    WHERE ol.order_id = NEW.id
      AND ol.assigned_pharmacy_id IS NOT NULL
    ON CONFLICT (order_line_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
CREATE TRIGGER trigger_enqueue_pharmacy_orders
AFTER UPDATE OF payment_status ON orders
FOR EACH ROW
EXECUTE FUNCTION enqueue_pharmacy_order_jobs();