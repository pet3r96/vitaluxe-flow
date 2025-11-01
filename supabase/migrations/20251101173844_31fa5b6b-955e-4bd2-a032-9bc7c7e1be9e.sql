-- Fix message_threads RLS to prevent data leakage
-- Drop the redundant "Users can view their own threads" policy that doesn't check thread_type
DROP POLICY IF EXISTS "Users can view their own threads" ON public.message_threads;

-- Ensure the correct policies exist and are the only SELECT policies
-- These policies are already in place but let's make sure they're correct

-- Support tickets: Only creator and admins can view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'message_threads' 
    AND policyname = 'Support tickets visible to creator and admins only'
  ) THEN
    CREATE POLICY "Support tickets visible to creator and admins only"
    ON public.message_threads
    FOR SELECT
    TO authenticated
    USING (
      thread_type = 'support' 
      AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    );
  END IF;
END$$;

-- Order issues: Only participants and admins can view
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'message_threads' 
    AND policyname = 'Order issues visible to participants'
  ) THEN
    CREATE POLICY "Order issues visible to participants"
    ON public.message_threads
    FOR SELECT
    TO authenticated
    USING (
      thread_type = 'order_issue' 
      AND public.is_thread_participant(auth.uid(), id)
    );
  END IF;
END$$;

-- Admins can view all threads (already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'message_threads' 
    AND policyname = 'Admins can view all threads'
  ) THEN
    CREATE POLICY "Admins can view all threads"
    ON public.message_threads
    FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;