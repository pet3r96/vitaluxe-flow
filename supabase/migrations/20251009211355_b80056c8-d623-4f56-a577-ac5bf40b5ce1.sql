-- Create security definer function to check thread participation
CREATE OR REPLACE FUNCTION public.is_thread_participant(_user_id uuid, _thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.thread_participants
    WHERE user_id = _user_id AND thread_id = _thread_id
  )
$$;

-- Drop existing problematic policy on thread_participants
DROP POLICY IF EXISTS "Users can view thread participants for their threads" ON public.thread_participants;

-- Create new policy using the security definer function
CREATE POLICY "Users can view thread participants"
ON public.thread_participants
FOR SELECT
TO authenticated
USING (public.is_thread_participant(auth.uid(), thread_id));

-- Update messages policies to use the security definer function
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their threads" ON public.messages;

CREATE POLICY "Users can view messages in their threads"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_thread_participant(auth.uid(), thread_id));

CREATE POLICY "Users can send messages to their threads"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND 
  public.is_thread_participant(auth.uid(), thread_id)
);