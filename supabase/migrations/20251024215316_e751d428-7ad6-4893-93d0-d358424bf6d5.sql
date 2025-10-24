-- Add 'on_hold' status to order_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'on_hold'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'on_hold';
  END IF;
END $$;