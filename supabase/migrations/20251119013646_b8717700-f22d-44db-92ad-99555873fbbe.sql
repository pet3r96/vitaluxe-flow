-- Phase 1 Security Lockdown: RLS Policy Fixes (Final)
-- CRITICAL: Fix public access vulnerabilities in sms_codes, pharmacy_order_jobs, and discount_codes

-- ============================================================================
-- 1. FIX sms_codes - CRITICAL: Remove public access, enforce user scoping
-- ============================================================================

-- Drop dangerous public policies
DROP POLICY IF EXISTS "allow_public_sms_codes_insert" ON public.sms_codes;
DROP POLICY IF EXISTS "allow_public_sms_codes_update" ON public.sms_codes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sms_codes;

-- Create secure, user-scoped policies for authenticated users only
CREATE POLICY "sms_codes_insert_own"
  ON public.sms_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can only insert codes for their own phone/email
    user_id = auth.uid()
  );

CREATE POLICY "sms_codes_select_own"
  ON public.sms_codes
  FOR SELECT
  TO authenticated
  USING (
    -- Users can only see their own codes
    user_id = auth.uid()
  );

CREATE POLICY "sms_codes_update_own"
  ON public.sms_codes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sms_codes_delete_own"
  ON public.sms_codes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do anything for system operations
CREATE POLICY "sms_codes_service_role_all"
  ON public.sms_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. FIX pharmacy_order_jobs - CRITICAL: Remove broad access, add scoping
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pharmacy_order_jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.pharmacy_order_jobs;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.pharmacy_order_jobs;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.pharmacy_order_jobs;

-- Pharmacy-scoped access: pharmacies can only see their assigned jobs
CREATE POLICY "pharmacy_jobs_select_assigned"
  ON public.pharmacy_order_jobs
  FOR SELECT
  TO authenticated
  USING (
    -- Pharmacy users can see jobs assigned to them
    EXISTS (
      SELECT 1 FROM public.pharmacies p
      WHERE p.id = pharmacy_order_jobs.pharmacy_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "pharmacy_jobs_update_assigned"
  ON public.pharmacy_order_jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- Pharmacy users can update jobs assigned to them
    EXISTS (
      SELECT 1 FROM public.pharmacies p
      WHERE p.id = pharmacy_order_jobs.pharmacy_id
      AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pharmacies p
      WHERE p.id = pharmacy_order_jobs.pharmacy_id
      AND p.user_id = auth.uid()
    )
  );

-- Admin users can see and manage all pharmacy jobs
CREATE POLICY "pharmacy_jobs_admin_all"
  ON public.pharmacy_order_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Service role can do anything for system operations (cron jobs, etc.)
CREATE POLICY "pharmacy_jobs_service_role_all"
  ON public.pharmacy_order_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. FIX discount_codes - MEDIUM: Confirm authenticated-only access
-- ============================================================================

-- Drop any public policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.discount_codes;
DROP POLICY IF EXISTS "allow_public_discount_codes_select" ON public.discount_codes;

-- Authenticated users can view active discount codes
CREATE POLICY "discount_codes_select_authenticated"
  ON public.discount_codes
  FOR SELECT
  TO authenticated
  USING (
    -- Users can only see active codes that are currently valid
    active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until >= now())
  );

-- Admin users can manage all discount codes
CREATE POLICY "discount_codes_admin_all"
  ON public.discount_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Service role full access
CREATE POLICY "discount_codes_service_role_all"
  ON public.discount_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Add audit logging for security events
-- ============================================================================

-- Log RLS policy changes
INSERT INTO public.audit_logs (action_type, entity_type, details, user_role)
VALUES (
  'security_lockdown_phase1',
  'rls_policies',
  jsonb_build_object(
    'tables_updated', ARRAY['sms_codes', 'pharmacy_order_jobs', 'discount_codes'],
    'timestamp', now(),
    'description', 'Phase 1 Security Lockdown: Fixed critical RLS vulnerabilities'
  ),
  'system'
);
