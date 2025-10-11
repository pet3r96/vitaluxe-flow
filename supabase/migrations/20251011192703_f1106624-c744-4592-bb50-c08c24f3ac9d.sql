-- Ensure RLS is enabled on involved tables (safe to run repeatedly)
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow Admins to view all participant rows (enables impersonation inbox join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'thread_participants' AND policyname = 'Admins can view all participant rows'
  ) THEN
    CREATE POLICY "Admins can view all participant rows"
    ON public.thread_participants
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

-- Allow Admins to view all messages (enables impersonation conversation pane)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'Admins can view all messages'
  ) THEN
    CREATE POLICY "Admins can view all messages"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;