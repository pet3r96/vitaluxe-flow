-- Fix message_threads RLS to prevent data leakage
-- Drop the redundant policy that allows viewing any thread without checking thread_type
DROP POLICY IF EXISTS "Users can view their own threads" ON public.message_threads;