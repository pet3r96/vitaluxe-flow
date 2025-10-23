-- Trigger to auto-sync rep_practice_links when profiles.linked_topline_id changes
CREATE OR REPLACE FUNCTION sync_rep_practice_link()
RETURNS TRIGGER AS $$
DECLARE
  v_rep_id UUID;
  v_rep_role app_role;
BEGIN
  -- Only process if linked_topline_id is set and this is a practice (has doctor role)
  IF NEW.linked_topline_id IS NOT NULL THEN
    -- Check if this profile has a doctor role
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.id AND role = 'doctor'::app_role
    ) THEN
      -- Try to find a downline rep first with this user_id
      SELECT id, role INTO v_rep_id, v_rep_role
      FROM reps
      WHERE user_id = NEW.linked_topline_id
        AND role = 'downline'::app_role
      LIMIT 1;
      
      -- If no downline found, try topline
      IF v_rep_id IS NULL THEN
        SELECT id, role INTO v_rep_id, v_rep_role
        FROM reps
        WHERE user_id = NEW.linked_topline_id
          AND role = 'topline'::app_role
        LIMIT 1;
      END IF;
      
      -- If we found a rep, upsert the link
      IF v_rep_id IS NOT NULL THEN
        INSERT INTO rep_practice_links (rep_id, practice_id, created_at)
        VALUES (v_rep_id, NEW.id, now())
        ON CONFLICT (rep_id, practice_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS sync_rep_practice_link_trigger ON profiles;
CREATE TRIGGER sync_rep_practice_link_trigger
  AFTER INSERT OR UPDATE OF linked_topline_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_rep_practice_link();