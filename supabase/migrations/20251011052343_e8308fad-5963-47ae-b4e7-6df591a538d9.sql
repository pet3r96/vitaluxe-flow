-- Fix RLS policies to allow admin impersonation for pending requests

-- Fix pending_practices INSERT policy
DROP POLICY IF EXISTS "Reps can insert pending practice requests" ON pending_practices;

CREATE POLICY "Reps and admins can insert pending practice requests"
  ON pending_practices FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_user_id 
    AND (
      has_role(auth.uid(), 'topline') 
      OR has_role(auth.uid(), 'downline')
      OR has_role(auth.uid(), 'admin')
    )
  );

-- Fix pending_reps INSERT policy
DROP POLICY IF EXISTS "Reps can insert pending rep requests" ON pending_reps;

CREATE POLICY "Reps and admins can insert pending rep requests"
  ON pending_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by_user_id 
    AND (
      has_role(auth.uid(), 'topline') 
      OR has_role(auth.uid(), 'downline')
      OR has_role(auth.uid(), 'admin')
    )
  );