
-- Pro Products table
CREATE TABLE public.pro_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active pro products"
  ON public.pro_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert pro products"
  ON public.pro_products FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pro products"
  ON public.pro_products FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pro products"
  ON public.pro_products FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pro Cart Items table
CREATE TABLE public.pro_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  practice_id uuid,
  pro_product_id uuid NOT NULL REFERENCES public.pro_products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pro cart items"
  ON public.pro_cart_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pro cart items"
  ON public.pro_cart_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pro cart items"
  ON public.pro_cart_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pro cart items"
  ON public.pro_cart_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Pro Orders table
CREATE TABLE public.pro_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  practice_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  ship_to_address jsonb,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  shipping numeric NOT NULL DEFAULT 20.00,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pro orders"
  ON public.pro_orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own pro orders"
  ON public.pro_orders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at on pro_products
CREATE TRIGGER update_pro_products_updated_at
  BEFORE UPDATE ON public.pro_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
