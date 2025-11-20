-- Phase 1.1: Clean up orphaned messages before adding FK constraint
DELETE FROM public.messages
WHERE thread_id NOT IN (SELECT id FROM public.message_threads);

-- Phase 1.2: Add foreign key constraint for messages.thread_id
ALTER TABLE public.messages
ADD CONSTRAINT messages_thread_id_fkey 
FOREIGN KEY (thread_id) 
REFERENCES public.message_threads(id) 
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_messages_thread_id 
ON public.messages(thread_id);