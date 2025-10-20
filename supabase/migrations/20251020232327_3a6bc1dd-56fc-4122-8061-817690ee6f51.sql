-- Phase 1: Fix RLS Policies for Public Data Exposure
-- This migration secures 8 tables that currently have overly permissive public access

-- ============================================================================
-- 1. PRODUCTS TABLE - Secure pricing and product catalog
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Everyone can view active products" ON public.products;

-- Add role-based policies
CREATE POLICY "Admins can manage all products"
ON public.products
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view visible products"
ON public.products
FOR SELECT
TO authenticated
USING (id IN (SELECT * FROM get_visible_products_for_user()));

-- ============================================================================
-- 2. PHARMACIES TABLE - Secure pharmacy partner information
-- ============================================================================

-- Drop existing public policies
DROP POLICY IF EXISTS "Pharmacies are viewable by everyone" ON public.pharmacies;
DROP POLICY IF EXISTS "Everyone can view pharmacies" ON public.pharmacies;

-- Add role-based policies
CREATE POLICY "Admins can manage all pharmacies"
ON public.pharmacies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can view and update their own record"
ON public.pharmacies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'pharmacy'::app_role) AND user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'pharmacy'::app_role) AND user_id = auth.uid());

CREATE POLICY "Authenticated users can view active pharmacies"
ON public.pharmacies
FOR SELECT
TO authenticated
USING (active = true);

-- ============================================================================
-- 3. PHARMACY_SHIPPING_RATES TABLE - Secure shipping cost data
-- ============================================================================

-- Drop existing public policies
DROP POLICY IF EXISTS "Pharmacy shipping rates are viewable by everyone" ON public.pharmacy_shipping_rates;
DROP POLICY IF EXISTS "Everyone can view pharmacy shipping rates" ON public.pharmacy_shipping_rates;

-- Add role-based policies
CREATE POLICY "Admins can manage all pharmacy shipping rates"
ON public.pharmacy_shipping_rates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Pharmacies can manage their own shipping rates"
ON public.pharmacy_shipping_rates
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'pharmacy'::app_role) AND 
  pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'pharmacy'::app_role) AND 
  pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())
);

CREATE POLICY "Authenticated users can view pharmacy shipping rates"
ON public.pharmacy_shipping_rates
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- 4. PRODUCT_TYPES TABLE - Secure product categories
-- ============================================================================

-- Drop existing public policies
DROP POLICY IF EXISTS "Product types are viewable by everyone" ON public.product_types;
DROP POLICY IF EXISTS "Everyone can view product types" ON public.product_types;

-- Add role-based policies
CREATE POLICY "Admins can manage all product types"
ON public.product_types
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active product types"
ON public.product_types
FOR SELECT
TO authenticated
USING (active = true);

-- ============================================================================
-- 5. ORDER_STATUS_CONFIGS TABLE - Secure internal workflow configuration
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Order status configs are viewable by authenticated users" ON public.order_status_configs;
DROP POLICY IF EXISTS "Everyone can view order status configs" ON public.order_status_configs;

-- Add role-based policies
CREATE POLICY "Admins can manage all order status configs"
ON public.order_status_configs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active order status configs"
ON public.order_status_configs
FOR SELECT
TO authenticated
USING (is_active = true);

-- ============================================================================
-- 6. SYSTEM_SETTINGS TABLE - Secure system configuration (ADMIN ONLY)
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "System settings are viewable by authenticated users" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated users can view system settings" ON public.system_settings;

-- Add admin-only policies
CREATE POLICY "Only admins can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 7. API_RATE_LIMITS_CONFIG TABLE - Secure API configuration (ADMIN ONLY)
-- ============================================================================

-- Drop existing public policies
DROP POLICY IF EXISTS "Everyone can view rate limit configs" ON public.api_rate_limits_config;
DROP POLICY IF EXISTS "API rate limits are viewable by everyone" ON public.api_rate_limits_config;

-- Add admin-only policies
CREATE POLICY "Only admins can manage API rate limits"
ON public.api_rate_limits_config
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 8. STATUSES TABLE - Secure status system configuration
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Statuses are viewable by authenticated users" ON public.statuses;
DROP POLICY IF EXISTS "Authenticated users can view statuses" ON public.statuses;

-- Add role-based policies
CREATE POLICY "Admins can manage all statuses"
ON public.statuses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view statuses"
ON public.statuses
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- AUDIT LOG: Document this security hardening
-- ============================================================================

INSERT INTO audit_logs (
  action_type,
  entity_type,
  details
) VALUES (
  'security_hardening',
  'rls_policies',
  jsonb_build_object(
    'migration', 'phase1_rls_security_fixes',
    'tables_updated', ARRAY[
      'products',
      'pharmacies', 
      'pharmacy_shipping_rates',
      'product_types',
      'order_status_configs',
      'system_settings',
      'api_rate_limits_config',
      'statuses'
    ],
    'issue', 'public_data_exposure',
    'fix', 'role_based_access_control',
    'timestamp', now()
  )
);