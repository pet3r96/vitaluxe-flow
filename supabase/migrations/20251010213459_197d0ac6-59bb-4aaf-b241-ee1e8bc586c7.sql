-- Fix data inconsistency: sync reps.assigned_topline_id with profiles.linked_topline_id
-- This ensures downlines show up correctly under their assigned topline reps

UPDATE reps r
SET assigned_topline_id = topline_rep.id,
    updated_at = now()
FROM profiles p
LEFT JOIN reps topline_rep ON topline_rep.user_id = p.linked_topline_id
WHERE r.user_id = p.id
  AND r.role = 'downline'
  AND p.linked_topline_id IS NOT NULL
  AND (r.assigned_topline_id IS DISTINCT FROM topline_rep.id);

-- Create trigger to keep reps.assigned_topline_id in sync when profiles.linked_topline_id changes
CREATE OR REPLACE FUNCTION public.sync_rep_topline_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topline_rep_id uuid;
BEGIN
  -- Only process if linked_topline_id changed
  IF NEW.linked_topline_id IS DISTINCT FROM OLD.linked_topline_id THEN
    -- Get the rep_id for the new topline
    IF NEW.linked_topline_id IS NOT NULL THEN
      SELECT id INTO v_topline_rep_id
      FROM reps
      WHERE user_id = NEW.linked_topline_id
        AND role = 'topline'
      LIMIT 1;
    END IF;

    -- Update the reps table
    UPDATE reps
    SET assigned_topline_id = v_topline_rep_id,
        updated_at = now()
    WHERE user_id = NEW.id
      AND role = 'downline';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS sync_rep_topline_on_profile_update ON profiles;
CREATE TRIGGER sync_rep_topline_on_profile_update
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_rep_topline_assignment();