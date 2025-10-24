-- Create message_thread_read_status table to track when users last read each thread
CREATE TABLE public.message_thread_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.message_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_message_thread_read_status_user_id ON public.message_thread_read_status(user_id);
CREATE INDEX idx_message_thread_read_status_thread_id ON public.message_thread_read_status(thread_id);

-- Enable RLS
ALTER TABLE public.message_thread_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/update their own read status
CREATE POLICY "Users can view own read status"
  ON public.message_thread_read_status
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own read status"
  ON public.message_thread_read_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own read status"
  ON public.message_thread_read_status
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable realtime for message_thread_read_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_thread_read_status;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count threads where:
  -- 1. User is a participant
  -- 2. Latest message is not from the user
  -- 3. No read status exists OR read status is older than latest message
  
  SELECT COUNT(DISTINCT mt.id)::INTEGER INTO v_count
  FROM message_threads mt
  INNER JOIN thread_participants tp ON tp.thread_id = mt.id
  LEFT JOIN LATERAL (
    SELECT m.id, m.sender_id, m.created_at
    FROM messages m
    WHERE m.thread_id = mt.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest_msg ON true
  LEFT JOIN message_thread_read_status rs ON rs.thread_id = mt.id AND rs.user_id = p_user_id
  WHERE tp.user_id = p_user_id
    AND latest_msg.sender_id != p_user_id
    AND (
      rs.last_read_at IS NULL
      OR rs.last_read_at < latest_msg.created_at
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$;