-- Fix the providers table foreign key relationship to enable efficient JOINs
-- This resolves the repeated 400 errors in network logs for providers_user_id_fkey

-- First, check if the foreign key already exists
DO $$ 
BEGIN
    -- Drop existing foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'providers_user_id_fkey' 
        AND table_name = 'providers'
    ) THEN
        ALTER TABLE public.providers DROP CONSTRAINT providers_user_id_fkey;
    END IF;
END $$;

-- Add proper foreign key relationship with cascade
ALTER TABLE public.providers 
ADD CONSTRAINT providers_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Create index for faster lookups on this relationship
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON public.providers(user_id);

-- Also ensure practice_id relationship is properly indexed
CREATE INDEX IF NOT EXISTS idx_providers_practice_id ON public.providers(practice_id);

-- Add index for common query patterns
CREATE INDEX IF NOT EXISTS idx_providers_user_practice ON public.providers(user_id, practice_id);