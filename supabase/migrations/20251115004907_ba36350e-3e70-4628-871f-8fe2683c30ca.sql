-- Add performance indexes for order queries
-- These indexes significantly improve query performance without sacrificing data

-- Index for pharmacy order queries (most common filter pattern)
CREATE INDEX IF NOT EXISTS idx_order_lines_pharmacy_status_created 
ON public.order_lines (assigned_pharmacy_id, status, created_at DESC);

-- Index for order payment status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_created 
ON public.orders (payment_status, created_at DESC);

-- Index for patient account lookups by user_id
CREATE INDEX IF NOT EXISTS idx_patient_accounts_user_id 
ON public.patient_accounts (user_id);

-- Index for practice subscription lookups
CREATE INDEX IF NOT EXISTS idx_practice_subscriptions_practice_id 
ON public.practice_subscriptions (practice_id);

-- Index for provider lookups by user_id
CREATE INDEX IF NOT EXISTS idx_providers_user_id 
ON public.providers (user_id);

-- Index for order lines by order_id for faster joins
CREATE INDEX IF NOT EXISTS idx_order_lines_order_id 
ON public.order_lines (order_id);
