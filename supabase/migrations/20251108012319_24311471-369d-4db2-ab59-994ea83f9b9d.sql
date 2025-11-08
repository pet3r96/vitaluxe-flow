-- Fix RLS policies for video_session_guest_links table

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow insert for practice owners and providers" ON video_session_guest_links;
DROP POLICY IF EXISTS "Allow select for practice owners and providers" ON video_session_guest_links;
DROP POLICY IF EXISTS "Allow update for practice owners and providers" ON video_session_guest_links;

-- Enable RLS
ALTER TABLE video_session_guest_links ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user can manage video session
CREATE OR REPLACE FUNCTION public.can_manage_video_session(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM video_sessions vs
    WHERE vs.id = _session_id
    AND (
      -- User is the practice owner
      vs.practice_id = _user_id
      OR
      -- User is a provider in the practice
      EXISTS (
        SELECT 1 FROM providers p
        WHERE p.user_id = _user_id
        AND p.practice_id = vs.practice_id
        AND p.active = true
      )
      OR
      -- User is staff in the practice with video permissions
      EXISTS (
        SELECT 1 FROM practice_staff ps
        WHERE ps.user_id = _user_id
        AND ps.practice_id = vs.practice_id
        AND ps.active = true
      )
    )
  )
$$;

-- Policy for INSERT: Allow practice owners, providers, and staff to create guest links
CREATE POLICY "Allow insert guest links for authorized users"
ON video_session_guest_links
FOR INSERT
WITH CHECK (
  public.can_manage_video_session(auth.uid(), session_id)
);

-- Policy for SELECT: Allow practice owners, providers, and staff to view guest links
CREATE POLICY "Allow select guest links for authorized users"
ON video_session_guest_links
FOR SELECT
USING (
  public.can_manage_video_session(auth.uid(), session_id)
);

-- Policy for UPDATE: Allow practice owners, providers, and staff to update guest links
CREATE POLICY "Allow update guest links for authorized users"
ON video_session_guest_links
FOR UPDATE
USING (
  public.can_manage_video_session(auth.uid(), session_id)
);