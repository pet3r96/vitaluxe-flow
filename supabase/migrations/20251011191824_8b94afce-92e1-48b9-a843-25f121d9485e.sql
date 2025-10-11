-- Enable RLS if not already enabled (safe to run repeatedly)
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;

-- 1) Allow any participant to view a thread
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'message_threads' AND policyname = 'Participants can view threads'
  ) THEN
    CREATE POLICY "Participants can view threads"
    ON public.message_threads
    FOR SELECT
    TO authenticated
    USING (public.is_thread_participant(auth.uid(), id));
  END IF;
END$$;

-- 2) Allow creators to update their own order_issue threads (resolve/reopen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'message_threads' AND policyname = 'Creators can update their order_issue threads'
  ) THEN
    CREATE POLICY "Creators can update their order_issue threads"
    ON public.message_threads
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by AND thread_type = 'order_issue')
    WITH CHECK (auth.uid() = created_by AND thread_type = 'order_issue');
  END IF;
END$$;

-- 3) Thread participants policies
-- 3a) Allow creator or admin to add participants to their thread
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'thread_participants' AND policyname = 'Creator or admin can add participants'
  ) THEN
    CREATE POLICY "Creator or admin can add participants"
    ON public.thread_participants
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.message_threads t
        WHERE t.id = thread_participants.thread_id
          AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      )
    );
  END IF;
END$$;

-- 3b) Allow users to view their own participant rows (useful for any UI listing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'thread_participants' AND policyname = 'Users can view own participant rows'
  ) THEN
    CREATE POLICY "Users can view own participant rows"
    ON public.thread_participants
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END$$;