-- Fix Order Status Configs Access
-- Drop public access policy
DROP POLICY IF EXISTS "Everyone can view active status configs" ON public.order_status_configs;

-- Drop existing authenticated policy and replace with role-restricted version
DROP POLICY IF EXISTS "Authenticated users can view active order status configs" ON public.order_status_configs;

-- Create role-restricted SELECT policy for authenticated staff only
CREATE POLICY "Staff can view active order status configs"
ON public.order_status_configs
FOR SELECT
TO authenticated
USING (
  is_active = true 
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'pharmacy'::app_role)
    OR has_role(auth.uid(), 'doctor'::app_role)
    OR has_role(auth.uid(), 'provider'::app_role)
  )
);

-- Fix Function Search Path for all SECURITY DEFINER functions
DO $$
DECLARE
  func_record RECORD;
  fix_query TEXT;
BEGIN
  -- Find all SECURITY DEFINER functions in public schema without explicit search_path
  FOR func_record IN
    SELECT 
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS function_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (
        p.proconfig IS NULL 
        OR NOT EXISTS (
          SELECT 1 
          FROM unnest(p.proconfig) AS config
          WHERE config LIKE 'search_path=%'
        )
      )
  LOOP
    -- Build ALTER FUNCTION statement
    fix_query := format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      func_record.schema_name,
      func_record.function_name,
      func_record.function_args
    );
    
    -- Execute the fix
    EXECUTE fix_query;
    
    RAISE NOTICE 'Fixed search_path for: %.%(%)', 
      func_record.schema_name, 
      func_record.function_name,
      func_record.function_args;
  END LOOP;
END $$;