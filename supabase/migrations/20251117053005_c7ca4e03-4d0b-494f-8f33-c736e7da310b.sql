-- ============================================================
-- BATCH 11 — FINAL RLS SANITY PASS
-- Ensures every table has at least 1 SELECT policy.
-- Ensures every table has RLS enabled.
-- Logs any inconsistencies for monitoring.
-- ============================================================

-------------------------------
-- 1. Enable RLS on all public tables
-------------------------------
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

-------------------------------
-- 2. Add admin fallback SELECT policy for tables missing one
-------------------------------
DO $$
DECLARE 
    r record;
    cnt int;
    policy_name text;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
          AND tablename NOT LIKE 'sql_%'
    LOOP
        -- Count existing SELECT policies
        SELECT COUNT(*) INTO cnt
        FROM pg_policies 
        WHERE schemaname = 'public'
          AND tablename = r.tablename
          AND cmd = 'SELECT';

        -- If no SELECT policy exists, add admin fallback
        IF cnt = 0 THEN
            policy_name := r.tablename || '_admin_fallback_select';
            
            -- Create the policy
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT USING (has_role(auth.uid(), ''admin''));',
                policy_name,
                r.tablename
            );
            
            -- Log the action
            INSERT INTO public.rls_audit_results (
                table_name, 
                checked_at, 
                rls_enabled, 
                issue_type, 
                details
            ) VALUES (
                r.tablename,
                now(),
                true,
                'MISSING_SELECT_POLICY_FIXED',
                'Admin fallback SELECT policy added: ' || policy_name
            );
        END IF;
    END LOOP;
END $$;