-- Fix generate_room_key function with proper implementation
CREATE OR REPLACE FUNCTION public.generate_room_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_key TEXT;
  key_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-char alphanumeric key: pr-xxxxxx (6 random chars)
    new_key := 'pr-' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM public.practice_video_rooms WHERE room_key = new_key) INTO key_exists;
    
    -- Exit loop if key is unique
    EXIT WHEN NOT key_exists;
  END LOOP;
  
  RETURN new_key;
END;
$$;

-- Fix generate_guest_token function with proper implementation  
CREATE OR REPLACE FUNCTION public.generate_guest_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 32-char secure random token
    new_token := encode(gen_random_bytes(24), 'base64');
    new_token := translate(new_token, '+/=', 'xyz');  -- Make URL-safe
    new_token := substring(new_token from 1 for 32);
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.video_guest_tokens WHERE token = new_token) INTO token_exists;
    
    -- Exit loop if token is unique
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;