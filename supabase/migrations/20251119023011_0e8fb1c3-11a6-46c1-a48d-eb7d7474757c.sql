-- =====================================================
-- PHASE 2 FINAL: Part 5 - Fix Security Definer Functions Search Path
-- Safe approach: Only fix functions that exist
-- =====================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all SECURITY DEFINER functions in public schema
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
    LOOP
        -- Set search_path for each function
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path TO ''public''',
            'public',
            func_record.function_name,
            func_record.arguments
        );
        
        RAISE NOTICE 'Fixed search_path for function: %.%(%)', 
            'public', func_record.function_name, func_record.arguments;
    END LOOP;
END $$;