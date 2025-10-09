-- Add missing RLS policies for commissions, message_threads, and thread_participants

-- RLS Policies for commissions
CREATE POLICY "Reps can view their own commissions"
  ON public.commissions FOR SELECT
  USING (auth.uid() = rep_id);

CREATE POLICY "Admins can view all commissions"
  ON public.commissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert commissions"
  ON public.commissions FOR INSERT
  WITH CHECK (true);

-- RLS Policies for message_threads
CREATE POLICY "Users can view threads they participate in"
  ON public.message_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.thread_participants
      WHERE thread_participants.thread_id = message_threads.id
      AND thread_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create message threads"
  ON public.message_threads FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Doctors can create message threads"
  ON public.message_threads FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'doctor'));

-- RLS Policies for thread_participants
CREATE POLICY "Users can view thread participants for their threads"
  ON public.thread_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.thread_participants tp
      WHERE tp.thread_id = thread_participants.thread_id
      AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "System can add thread participants"
  ON public.thread_participants FOR INSERT
  WITH CHECK (true);
