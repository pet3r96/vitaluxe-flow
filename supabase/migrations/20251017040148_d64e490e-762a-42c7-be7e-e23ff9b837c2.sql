-- Fix get_topline_rep_id_for_practice to handle downlines
CREATE OR REPLACE FUNCTION public.get_topline_rep_id_for_practice(_practice_linked_topline_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rep_id uuid;
  v_rep_role app_role;
  v_assigned_topline_id uuid;
BEGIN
  -- Get the rep info for this user
  SELECT id, role, assigned_topline_id
  INTO v_rep_id, v_rep_role, v_assigned_topline_id
  FROM public.reps
  WHERE user_id = _practice_linked_topline_user_id
  LIMIT 1;
  
  -- If they're a topline, return their ID
  IF v_rep_role = 'topline'::app_role THEN
    RETURN v_rep_id;
  END IF;
  
  -- If they're a downline, return their assigned topline
  IF v_rep_role = 'downline'::app_role THEN
    RETURN v_assigned_topline_id;
  END IF;
  
  -- Otherwise return NULL
  RETURN NULL;
END;
$$;