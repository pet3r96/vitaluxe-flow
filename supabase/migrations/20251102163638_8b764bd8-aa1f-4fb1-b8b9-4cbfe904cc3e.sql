-- Improve sync_rep_practice_link trigger to handle full rep chain
-- This ensures both downline and topline links are created when a practice is assigned

CREATE OR REPLACE FUNCTION public.sync_rep_practice_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rep_id UUID;
  v_rep_role app_role;
  v_topline_rep_id UUID;
BEGIN
  -- Only process if linked_topline_id is set and this is a practice (has doctor role)
  IF NEW.linked_topline_id IS NOT NULL THEN
    -- Check if this profile has a doctor role
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.id AND role = 'doctor'::app_role
    ) THEN
      -- Try to find a downline rep first with this user_id
      SELECT id, role, assigned_topline_id INTO v_rep_id, v_rep_role, v_topline_rep_id
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
      
      -- If we found a rep, upsert the direct link
      IF v_rep_id IS NOT NULL THEN
        INSERT INTO rep_practice_links (rep_id, practice_id, created_at)
        VALUES (v_rep_id, NEW.id, now())
        ON CONFLICT (rep_id, practice_id) DO NOTHING;
        
        -- If this is a downline with a topline, also create topline link
        IF v_rep_role = 'downline'::app_role AND v_topline_rep_id IS NOT NULL THEN
          INSERT INTO rep_practice_links (rep_id, practice_id, created_at)
          VALUES (v_topline_rep_id, NEW.id, now())
          ON CONFLICT (rep_id, practice_id) DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Handle removal of rep assignment (when linked_topline_id becomes NULL)
  IF OLD.linked_topline_id IS NOT NULL AND NEW.linked_topline_id IS NULL THEN
    -- Remove all rep_practice_links for this practice
    DELETE FROM rep_practice_links WHERE practice_id = NEW.id;
  END IF;
  
  -- Handle change of rep assignment (when linked_topline_id changes to a different rep)
  IF OLD.linked_topline_id IS NOT NULL 
     AND NEW.linked_topline_id IS NOT NULL 
     AND OLD.linked_topline_id != NEW.linked_topline_id THEN
    -- Remove old rep_practice_links
    DELETE FROM rep_practice_links WHERE practice_id = NEW.id;
    -- The new links will be created by the logic above
  END IF;
  
  RETURN NEW;
END;
$$;