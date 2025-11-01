-- Phase 1: Tighten message_threads SELECT visibility
-- Remove overly broad participant viewing policy
DROP POLICY IF EXISTS "Participants can view threads" ON public.message_threads;

-- Ensure users can view their own threads (keep if exists)
DROP POLICY IF EXISTS "Users can view their own threads" ON public.message_threads;
CREATE POLICY "Users can view their own threads"
ON public.message_threads
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Order issues: visible to explicit participants only
CREATE POLICY "Order issues visible to participants"
ON public.message_threads
FOR SELECT
TO authenticated
USING (
  thread_type = 'order_issue'
  AND is_thread_participant(auth.uid(), id)
);

-- Support tickets: visible ONLY to creator and admins (no staff inheritance)
CREATE POLICY "Support tickets visible to creator and admins only"
ON public.message_threads
FOR SELECT
TO authenticated
USING (
  thread_type = 'support'
  AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
);

-- Phase 2: Restrict who can add participants to threads
-- Remove permissive policies
DROP POLICY IF EXISTS "System can add thread participants" ON public.thread_participants;
DROP POLICY IF EXISTS "Creator or admin can add participants" ON public.thread_participants;

-- Only allow adding participants to order issues (not support tickets)
-- Restrict to creator/admin adding only creator or pharmacy users
CREATE POLICY "Add participants to order issues only (creator/admin)"
ON public.thread_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id
      AND t.thread_type = 'order_issue'
      AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
      AND (
        user_id = t.created_by
        OR has_role(user_id, 'pharmacy'::app_role)
      )
  )
);

-- Phase 3: Apply parallel enforcement on messages table
-- Remove existing broad policies
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their threads" ON public.messages;

-- Support threads: view only if creator or admin
CREATE POLICY "View messages in support threads (creator/admin only)"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id
      AND t.thread_type = 'support'
      AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Support threads: send only if creator or admin
CREATE POLICY "Send messages in support threads (creator/admin only)"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = sender_id)
  AND EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id
      AND t.thread_type = 'support'
      AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Order issue threads: view only if participant
CREATE POLICY "View messages in order issue threads (participants)"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id
      AND t.thread_type = 'order_issue'
      AND is_thread_participant(auth.uid(), t.id)
  )
);

-- Order issue threads: send only if participant
CREATE POLICY "Send messages in order issue threads (participants)"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = sender_id)
  AND EXISTS (
    SELECT 1 FROM public.message_threads t
    WHERE t.id = thread_id
      AND t.thread_type = 'order_issue'
      AND is_thread_participant(auth.uid(), t.id)
  )
);