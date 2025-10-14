BEGIN;

-- 1) Add per-user limit column to discount_codes
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER;

-- 2) Create per-user usage tracking table
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(discount_code_id, user_id)
);

-- Enable RLS on discount_code_usage
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_code_usage (idempotent creation)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'discount_code_usage' AND policyname = 'Admins can view all discount code usage'
  ) THEN
    CREATE POLICY "Admins can view all discount code usage"
    ON public.discount_code_usage
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'discount_code_usage' AND policyname = 'System can insert discount code usage'
  ) THEN
    CREATE POLICY "System can insert discount code usage"
    ON public.discount_code_usage
    FOR INSERT
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'discount_code_usage' AND policyname = 'System can update discount code usage'
  ) THEN
    CREATE POLICY "System can update discount code usage"
    ON public.discount_code_usage
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_user ON public.discount_code_usage(discount_code_id, user_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_user ON public.discount_code_usage(user_id);

-- Trigger to auto-update updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_discount_code_usage_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_discount_code_usage_updated_at
    BEFORE UPDATE ON public.discount_code_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3) Update validate_discount_code to enforce per-user limits (keep signature/return type)
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text)
RETURNS TABLE(valid boolean, discount_percentage numeric, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code RECORD;
  v_user_usage_count INTEGER := 0;
  v_user_id uuid := auth.uid();
BEGIN
  SELECT * INTO v_code
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code)
    AND active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR current_uses < max_uses)
  LIMIT 1;
  
  IF v_code IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL(5,2), 'Invalid or expired discount code';
    RETURN;
  END IF;

  -- Enforce per-user limit if available
  IF v_user_id IS NOT NULL AND v_code.max_uses_per_user IS NOT NULL THEN
    SELECT COALESCE(usage_count, 0) INTO v_user_usage_count
    FROM discount_code_usage
    WHERE discount_code_id = v_code.id
      AND user_id = v_user_id;

    IF v_user_usage_count >= v_code.max_uses_per_user THEN
      RETURN QUERY SELECT false, 0::DECIMAL(5,2), 'You have reached the maximum number of uses for this code';
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true, v_code.discount_percentage, 'Discount code applied successfully';
END;
$function$;

-- 4) Update increment_discount_usage to record per-user usage (keep signature)
CREATE OR REPLACE FUNCTION public.increment_discount_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_code_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  SELECT id INTO v_code_id
  FROM discount_codes
  WHERE UPPER(code) = UPPER(p_code);
  
  IF v_code_id IS NULL THEN
    RAISE EXCEPTION 'Discount code not found';
  END IF;
  
  -- Update global usage count
  UPDATE discount_codes
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_code_id;
  
  -- Track per-user usage when user is available
  IF v_user_id IS NOT NULL THEN
    INSERT INTO discount_code_usage (discount_code_id, user_id, usage_count, first_used_at, last_used_at)
    VALUES (v_code_id, v_user_id, 1, now(), now())
    ON CONFLICT (discount_code_id, user_id)
    DO UPDATE SET
      usage_count = discount_code_usage.usage_count + 1,
      last_used_at = now(),
      updated_at = now();
  END IF;
END;
$function$;

COMMIT;