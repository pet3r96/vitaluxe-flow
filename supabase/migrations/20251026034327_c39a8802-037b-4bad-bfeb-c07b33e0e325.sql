-- Create RLS-protected view wrapper for rep_productivity_summary
-- Views inherit security from underlying tables, but we can add WHERE conditions
-- to enforce access control using security definer functions

CREATE OR REPLACE VIEW public.rep_productivity_view AS
SELECT 
  rps.*
FROM public.rep_productivity_summary rps
WHERE
  -- Admins see everything
  public.has_role(auth.uid(), 'admin'::app_role)
  -- Topline reps see themselves + their downlines
  OR rps.user_id = auth.uid()
  OR rps.assigned_topline_id = public.get_current_user_rep_id()
  -- Downline reps see only themselves (covered by user_id = auth.uid() above)
;

-- Grant access to authenticated users
GRANT SELECT ON public.rep_productivity_view TO authenticated;

COMMENT ON VIEW public.rep_productivity_view IS 
'Secure view wrapper for rep_productivity_summary with built-in access control. 
Admins see all reps, topline reps see their network, downline reps see only themselves.';