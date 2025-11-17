-- Drop problematic policies
DROP POLICY IF EXISTS "practice_insert_orders" ON orders;
DROP POLICY IF EXISTS "practice_view_orders" ON orders;

-- Create security definer function to check practice staff access
CREATE OR REPLACE FUNCTION public.can_access_practice_orders(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM practice_staff ps
    WHERE ps.practice_id = _practice_id
      AND ps.user_id = _user_id
      AND ps.active = true
  )
$$;

-- Create security definer function to check if user can order for practice
CREATE OR REPLACE FUNCTION public.can_order_for_practice(_user_id uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM practice_staff ps
    WHERE ps.practice_id = _practice_id
      AND ps.user_id = _user_id
      AND ps.active = true
      AND ps.can_order = true
  )
$$;

-- Recreate policies using security definer functions
CREATE POLICY "practice_view_orders"
ON orders
FOR SELECT
USING (
  doctor_id = auth.uid() 
  OR can_access_practice_orders(auth.uid(), doctor_id)
);

CREATE POLICY "practice_insert_orders"
ON orders
FOR INSERT
WITH CHECK (
  doctor_id = auth.uid() 
  OR can_order_for_practice(auth.uid(), doctor_id)
);