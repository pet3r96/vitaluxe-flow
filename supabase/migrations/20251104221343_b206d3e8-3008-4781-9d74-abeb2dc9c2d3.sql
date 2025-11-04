-- Enable RLS (safe if already enabled)
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for support_tickets if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'support_tickets' 
      AND policyname = 'Staff view practice support tickets'
  ) THEN
    CREATE POLICY "Staff view practice support tickets"
    ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.practice_staff ps
        WHERE ps.user_id = auth.uid()
          AND ps.active = true
          AND ps.practice_id = support_tickets.practice_id
      )
    );
  END IF;
END$$;

-- Create policy for patient_messages if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'patient_messages' 
      AND policyname = 'Staff view practice patient messages'
  ) THEN
    CREATE POLICY "Staff view practice patient messages"
    ON public.patient_messages
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.practice_staff ps
        WHERE ps.user_id = auth.uid()
          AND ps.active = true
          AND ps.practice_id = patient_messages.practice_id
      )
    );
  END IF;
END$$;