-- Staff access policies for support tickets and message threads

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'support_tickets' 
      AND policyname = 'Staff view practice support tickets'
  ) THEN
    CREATE POLICY "Staff view practice support tickets"
    ON public.support_tickets
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.practice_staff ps
        WHERE ps.user_id = auth.uid()
          AND ps.active = true
          AND ps.practice_id = support_tickets.practice_id
      )
    );
  END IF;
END $$;

-- Allow staff to view support message threads created by their practice owner/doctor
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'message_threads' 
      AND policyname = 'Staff view practice support threads'
  ) THEN
    CREATE POLICY "Staff view practice support threads"
    ON public.message_threads
    FOR SELECT
    USING (
      thread_type = 'support'
      AND EXISTS (
        SELECT 1 
        FROM public.practice_staff ps
        WHERE ps.user_id = auth.uid()
          AND ps.active = true
          AND ps.practice_id = message_threads.created_by
      )
    );
  END IF;
END $$;
