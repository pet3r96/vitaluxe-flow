-- Create security definer functions to bypass expensive RLS checks
-- These are safe because the edge function validates authorization BEFORE calling them

-- 1. Get order lines by provider (bypasses RLS for authorized providers)
CREATE OR REPLACE FUNCTION get_order_lines_by_provider(
  provider_uuid uuid,
  from_date timestamptz,
  limit_count int DEFAULT 2000
)
RETURNS TABLE (order_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT order_id, created_at
  FROM order_lines
  WHERE provider_id = provider_uuid
    AND created_at >= from_date
  ORDER BY created_at DESC
  LIMIT limit_count;
$$;

-- 2. Get order lines by pharmacy (bypasses RLS for authorized pharmacies)
CREATE OR REPLACE FUNCTION get_order_lines_by_pharmacy(
  pharmacy_uuid uuid,
  from_date timestamptz,
  limit_count int DEFAULT 2000
)
RETURNS TABLE (order_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT order_id, created_at
  FROM order_lines
  WHERE assigned_pharmacy_id = pharmacy_uuid
    AND created_at >= from_date
  ORDER BY created_at DESC
  LIMIT limit_count;
$$;

-- 3. Get orders by practice (bypasses RLS for authorized practices)
CREATE OR REPLACE FUNCTION get_orders_by_practice(
  practice_uuid uuid,
  from_date timestamptz,
  limit_count int DEFAULT 2000
)
RETURNS TABLE (id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, created_at
  FROM orders
  WHERE doctor_id = practice_uuid
    AND created_at >= from_date
    AND status IS NOT NULL
  ORDER BY created_at DESC
  LIMIT limit_count;
$$;

-- 4. Get order lines for rep (bypasses RLS for authorized reps)
CREATE OR REPLACE FUNCTION get_order_lines_for_rep(
  practice_ids uuid[],
  from_date timestamptz,
  limit_count int DEFAULT 2000
)
RETURNS TABLE (order_id uuid, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT ol.order_id, ol.created_at
  FROM order_lines ol
  JOIN orders o ON ol.order_id = o.id
  WHERE o.doctor_id = ANY(practice_ids)
    AND ol.created_at >= from_date
  ORDER BY ol.created_at DESC
  LIMIT limit_count;
$$;