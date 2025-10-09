-- Add resolved tracking and creator tracking to message_threads
ALTER TABLE public.message_threads 
ADD COLUMN resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN resolved_by UUID REFERENCES auth.users(id),
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX idx_message_threads_resolved ON public.message_threads(resolved);
CREATE INDEX idx_message_threads_created_by ON public.message_threads(created_by);

-- Update RLS policies for message_threads
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can create message threads" ON public.message_threads;
DROP POLICY IF EXISTS "Doctors can create message threads" ON public.message_threads;
DROP POLICY IF EXISTS "Users can view threads they participate in" ON public.message_threads;

-- Allow users to create threads and set themselves as creator
CREATE POLICY "Users can create message threads"
ON public.message_threads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow users to view threads they created
CREATE POLICY "Users can view their own threads"
ON public.message_threads
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Allow admins to view all threads
CREATE POLICY "Admins can view all threads"
ON public.message_threads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update threads (for marking resolved)
CREATE POLICY "Admins can update threads"
ON public.message_threads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));