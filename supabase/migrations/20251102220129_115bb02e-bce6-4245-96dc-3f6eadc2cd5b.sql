-- Add prescriber_name column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prescriber_name TEXT;