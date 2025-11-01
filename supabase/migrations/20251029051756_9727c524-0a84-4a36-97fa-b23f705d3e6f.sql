-- Function to get all assignable users for a practice (admin, providers, staff)
CREATE OR REPLACE FUNCTION get_practice_assignable_users(p_practice_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT,
  role_display TEXT,
  staff_role_type TEXT
) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, role, role_display, staff_role_type FROM (
    -- Get admin (the practice itself)
    SELECT 
      p.id,
      p.name,
      'admin'::TEXT as role,
      'Admin'::TEXT as role_display,
      NULL::TEXT as staff_role_type,
      1 as role_order
    FROM profiles p
    WHERE p.id = p_practice_id
      AND p.active = true
    
    UNION ALL
    
    -- Get all providers for this practice
    SELECT 
      p.id,
      p.name,
      'provider'::TEXT as role,
      'Provider'::TEXT as role_display,
      NULL::TEXT as staff_role_type,
      2 as role_order
    FROM profiles p
    JOIN providers prov ON p.id = prov.user_id
    WHERE prov.practice_id = p_practice_id
      AND prov.active = true
    
    UNION ALL
    
    -- Get all staff for this practice
    SELECT 
      p.id,
      p.name,
      'staff'::TEXT as role,
      COALESCE('Staff - ' || ps.role_type, 'Staff')::TEXT as role_display,
      ps.role_type as staff_role_type,
      3 as role_order
    FROM profiles p
    JOIN practice_staff ps ON p.id = ps.user_id
    WHERE ps.practice_id = p_practice_id
      AND ps.active = true
  ) assignable_users
  ORDER BY role_order, name;
$$;