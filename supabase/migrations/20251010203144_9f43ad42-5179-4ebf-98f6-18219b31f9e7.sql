-- Add topline and downline roles to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'topline';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'downline';

-- Create reps table (independent tracking)
CREATE TABLE IF NOT EXISTS public.reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role app_role NOT NULL CHECK (role IN ('topline', 'downline')),
  assigned_topline_id UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rep_practice_links join table
CREATE TABLE IF NOT EXISTS public.rep_practice_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES public.reps(id) ON DELETE CASCADE NOT NULL,
  practice_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_topline_id UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(rep_id, practice_id)
);

-- Create product_pricing_tiers table
CREATE TABLE IF NOT EXISTS public.product_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL UNIQUE,
  base_price DECIMAL(10,2) NOT NULL,
  topline_price DECIMAL(10,2) NOT NULL,
  downline_price DECIMAL(10,2) NOT NULL,
  practice_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_profits table
CREATE TABLE IF NOT EXISTS public.order_profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  order_line_id UUID REFERENCES public.order_lines(id) ON DELETE CASCADE NOT NULL,
  topline_id UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  downline_id UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  base_price DECIMAL(10,2) NOT NULL,
  topline_price DECIMAL(10,2),
  downline_price DECIMAL(10,2),
  practice_price DECIMAL(10,2) NOT NULL,
  topline_profit DECIMAL(10,2) DEFAULT 0,
  downline_profit DECIMAL(10,2) DEFAULT 0,
  admin_profit DECIMAL(10,2) DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_practice_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_profits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reps table
CREATE POLICY "Admins can manage all reps"
  ON public.reps FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Toplines can view their downlines"
  ON public.reps FOR SELECT
  USING (
    has_role(auth.uid(), 'topline'::app_role) 
    AND assigned_topline_id IN (SELECT id FROM public.reps WHERE user_id = auth.uid())
  );

CREATE POLICY "Reps can view own record"
  ON public.reps FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for rep_practice_links
CREATE POLICY "Admins can manage all rep practice links"
  ON public.rep_practice_links FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view their practice links"
  ON public.rep_practice_links FOR SELECT
  USING (
    rep_id IN (SELECT id FROM public.reps WHERE user_id = auth.uid())
  );

CREATE POLICY "Toplines can view downline practice links"
  ON public.rep_practice_links FOR SELECT
  USING (
    assigned_topline_id IN (SELECT id FROM public.reps WHERE user_id = auth.uid())
  );

-- RLS Policies for product_pricing_tiers
CREATE POLICY "Admins can manage pricing tiers"
  ON public.product_pricing_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view pricing tiers"
  ON public.product_pricing_tiers FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies for order_profits
CREATE POLICY "Admins can view all order profits"
  ON public.order_profits FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Toplines can view their order profits"
  ON public.order_profits FOR SELECT
  USING (
    topline_id IN (SELECT id FROM public.reps WHERE user_id = auth.uid())
  );

CREATE POLICY "Downlines can view their order profits"
  ON public.order_profits FOR SELECT
  USING (
    downline_id IN (SELECT id FROM public.reps WHERE user_id = auth.uid())
  );

CREATE POLICY "System can insert order profits"
  ON public.order_profits FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reps_user_id ON public.reps(user_id);
CREATE INDEX IF NOT EXISTS idx_reps_assigned_topline ON public.reps(assigned_topline_id);
CREATE INDEX IF NOT EXISTS idx_rep_practice_links_rep ON public.rep_practice_links(rep_id);
CREATE INDEX IF NOT EXISTS idx_rep_practice_links_practice ON public.rep_practice_links(practice_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON public.product_pricing_tiers(product_id);
CREATE INDEX IF NOT EXISTS idx_order_profits_order ON public.order_profits(order_id);
CREATE INDEX IF NOT EXISTS idx_order_profits_topline ON public.order_profits(topline_id);
CREATE INDEX IF NOT EXISTS idx_order_profits_downline ON public.order_profits(downline_id);

-- Trigger for updated_at on reps
CREATE TRIGGER update_reps_updated_at
  BEFORE UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on product_pricing_tiers
CREATE TRIGGER update_product_pricing_tiers_updated_at
  BEFORE UPDATE ON public.product_pricing_tiers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();