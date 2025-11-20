-- Drop old scalar function that adds E.164 formatting (+1 prefix)
-- This prevents conflicts with the new trigger function that stores 10 digits only

DROP FUNCTION IF EXISTS public.normalize_phone(text);