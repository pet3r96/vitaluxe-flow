-- =============================================================================
-- Enable pg_stat_statements for Query Performance Monitoring
-- =============================================================================
-- Generated: 2025-11-17
-- Phase: 6B - Security & Performance Fixes
-- Status: READY FOR PRODUCTION (SAFE TO APPLY)
--
-- Purpose: Enable PostgreSQL's built-in query performance tracking extension
-- Impact: Minimal overhead (~1-2% CPU), invaluable for performance tuning
-- Reversible: Yes (DROP EXTENSION)
--
-- =============================================================================

-- Step 1: Create the extension (if not already exists)
-- This is idempotent - safe to run multiple times
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Step 2: Configure extension parameters
-- These settings control how many queries to track and what detail to capture
-- -----------------------------------------------------------------------------

-- Track all queries (top-level and nested)
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- Increase the number of tracked queries (default: 5000)
-- Recommended for production: 10000
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Track utility commands (CREATE, ALTER, etc.) in addition to SELECT/INSERT/UPDATE/DELETE
ALTER SYSTEM SET pg_stat_statements.track_utility = 'on';

-- Track planning time separately from execution time
ALTER SYSTEM SET pg_stat_statements.track_planning = 'on';

-- Step 3: Reload configuration
-- This applies the settings without restarting PostgreSQL
-- -----------------------------------------------------------------------------
SELECT pg_reload_conf();

-- Step 4: Verify installation
-- Expected output: pg_stat_statements should appear in the list
-- -----------------------------------------------------------------------------
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

-- View top 10 slowest queries by total time
-- -----------------------------------------------------------------------------
/*
SELECT 
  query,
  calls,
  total_exec_time / 1000 AS total_seconds,
  mean_exec_time / 1000 AS avg_seconds,
  max_exec_time / 1000 AS max_seconds
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
*/

-- View top 10 most frequently called queries
-- -----------------------------------------------------------------------------
/*
SELECT 
  query,
  calls,
  mean_exec_time / 1000 AS avg_seconds
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
*/

-- Find queries with high variance (inconsistent performance)
-- -----------------------------------------------------------------------------
/*
SELECT 
  query,
  calls,
  stddev_exec_time / 1000 AS stddev_seconds,
  mean_exec_time / 1000 AS avg_seconds,
  (stddev_exec_time / mean_exec_time * 100) AS variance_percent
FROM pg_stat_statements
WHERE calls > 10
ORDER BY variance_percent DESC
LIMIT 10;
*/

-- Reset statistics (useful after optimization)
-- -----------------------------------------------------------------------------
-- SELECT pg_stat_statements_reset();

-- =============================================================================
-- MONITORING RECOMMENDATIONS
-- =============================================================================

-- 1. Establish baseline (first 7 days)
--    - Run queries above daily
--    - Export results to CSV for trend analysis
--    - Identify normal vs. abnormal patterns

-- 2. Set up automated alerts (Week 2+)
--    - Query with avg_exec_time > 1 second
--    - Query with calls > 10,000/hour (possible N+1 issue)
--    - Query with high variance (> 50%)

-- 3. Weekly performance review
--    - Top 10 slowest queries
--    - New queries appearing in top 20
--    - Queries with degrading performance

-- 4. Quarterly optimization cycle
--    - Add indexes for slow queries
--    - Refactor inefficient queries
--    - Adjust RLS policies if causing bottlenecks

-- =============================================================================
-- TROUBLESHOOTING
-- =============================================================================

-- Issue: Extension won't enable
-- Solution: Ensure superuser privileges or use Supabase dashboard
-- Command: ALTER USER your_user WITH SUPERUSER;

-- Issue: No data showing up
-- Solution: Wait 5-10 minutes for queries to accumulate
-- Verify: SELECT COUNT(*) FROM pg_stat_statements;

-- Issue: Performance degradation after enabling
-- Solution: Reduce max tracked queries
-- Command: ALTER SYSTEM SET pg_stat_statements.max = 5000;

-- =============================================================================
-- ROLLBACK PLAN
-- =============================================================================

-- If you need to disable pg_stat_statements:
/*
ALTER SYSTEM RESET pg_stat_statements.track;
ALTER SYSTEM RESET pg_stat_statements.max;
ALTER SYSTEM RESET pg_stat_statements.track_utility;
ALTER SYSTEM RESET pg_stat_statements.track_planning;
SELECT pg_reload_conf();
DROP EXTENSION pg_stat_statements;
*/

-- =============================================================================
-- DEPLOYMENT CHECKLIST
-- =============================================================================
-- [ ] Review SQL above
-- [ ] Backup database (pg_dump)
-- [ ] Apply CREATE EXTENSION command
-- [ ] Apply ALTER SYSTEM commands
-- [ ] Run SELECT pg_reload_conf()
-- [ ] Verify with SELECT * FROM pg_extension
-- [ ] Wait 10 minutes, run sample queries
-- [ ] Set up monitoring dashboard
-- [ ] Document baseline metrics
-- [ ] Schedule weekly performance review

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================
-- - pg_stat_statements does NOT log query parameters (safe for PHI)
-- - Only aggregated statistics are stored
-- - Queries are normalized: "SELECT * FROM users WHERE id = $1"
-- - No patient names, emails, or sensitive data exposed
-- - HIPAA compliant for performance monitoring

-- =============================================================================
-- END OF FILE
-- =============================================================================
