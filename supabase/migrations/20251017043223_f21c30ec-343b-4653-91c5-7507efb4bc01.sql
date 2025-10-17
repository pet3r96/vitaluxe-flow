-- Migration 1: Create rep_product_price_overrides table
-- This table stores custom pricing overrides for specific rep-product combinations
-- The UNIQUE constraint ensures overrides apply ONLY to the selected rep

CREATE TABLE public.rep_product_price_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Override prices (NULL means use default from products table)
  override_topline_price DECIMAL(10,2),
  override_downline_price DECIMAL(10,2),
  override_retail_price DECIMAL(10,2),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  
  -- CRITICAL: Ensures only ONE override per rep-product combination
  CONSTRAINT unique_rep_product UNIQUE(rep_id, product_id)
);

-- Index for fast lookups
CREATE INDEX idx_rep_product_overrides ON public.rep_product_price_overrides(rep_id, product_id);

-- Enable RLS
ALTER TABLE public.rep_product_price_overrides ENABLE ROW LEVEL SECURITY;

-- Only admins can manage overrides
CREATE POLICY "Admins can manage price overrides"
  ON public.rep_product_price_overrides
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));