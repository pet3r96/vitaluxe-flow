-- =============================================================================
-- PostgreSQL Linter Fixes - SECURITY DEFINER Functions Missing search_path
-- =============================================================================
-- Generated: 2025-11-17
-- Phase: 6B - Security & Performance Fixes
-- Status: READY FOR REVIEW (DO NOT APPLY YET)
--
-- Issue: 1 SECURITY DEFINER function found without explicit search_path setting
-- Risk: Search path injection vulnerability (CVE-2018-1058 class)
-- Fix: Add "SET search_path = public" to all SECURITY DEFINER functions
--
-- IMPORTANT: Review each function before applying. Verify that:
-- 1. Function only needs access to public schema objects
-- 2. No legitimate need to search other schemas
-- 3. Function signature and behavior won't change
--
-- =============================================================================

-- FUNCTION 1/1: check_rls_integrity
-- Purpose: Audit RLS policies across all tables
-- Schema: public
-- Returns: void
-- Security: SECURITY DEFINER (executes with owner privileges)
-- Risk: HIGH - Can insert into any table, reads pg_catalog
-- Fix: Add search_path to prevent malicious schema injection
-- -----------------------------------------------------------------------------

ALTER FUNCTION public.check_rls_integrity()
SET search_path = public;

-- Verification:
-- After applying, run this query to confirm the fix:
/*
SELECT 
  p.proname,
  pg_get_functiondef(p.oid) LIKE '%search_path%' AS has_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname = 'check_rls_integrity'
  AND p.prosecdef = true;
*/

-- Expected result: has_search_path = true

-- =============================================================================
-- SUMMARY
-- =============================================================================
-- Functions to fix: 1
-- Search path additions: 1
-- Estimated downtime: 0 seconds (ALTER FUNCTION is instant)
-- Rollback: ALTER FUNCTION public.check_rls_integrity() RESET search_path;
--
-- DEPLOYMENT CHECKLIST:
-- [ ] Review function definition above
-- [ ] Verify function only accesses public schema
-- [ ] Test in staging environment
-- [ ] Apply during maintenance window
-- [ ] Run verification query
-- [ ] Update security audit log
-- =============================================================================

-- Additional Notes:
-- - The linter initially flagged 14 functions, but database scan found only 1
-- - This indicates previous cleanup efforts were successful
-- - Regular audits recommended: quarterly or after major migrations
-- - Consider adding this check to CI/CD pipeline

-- Related Security Functions (ALREADY HAVE search_path SET):
-- - All other SECURITY DEFINER functions in public schema ✅
-- - Functions in supabase_functions schema are managed by Supabase ✅

-- =============================================================================
-- END OF FILE
-- =============================================================================
