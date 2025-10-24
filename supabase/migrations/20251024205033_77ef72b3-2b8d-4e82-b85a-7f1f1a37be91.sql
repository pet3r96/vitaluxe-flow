-- Add 'declined' status to order_status enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'declined' 
    AND enumtypid = 'order_status'::regtype
  ) THEN
    ALTER TYPE order_status ADD VALUE 'declined';
  END IF;
END $$;