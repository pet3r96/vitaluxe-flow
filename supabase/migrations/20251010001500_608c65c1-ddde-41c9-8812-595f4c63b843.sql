-- Update profiles table for additional provider info
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create provider_payment_methods table for Plaid integration
CREATE TABLE IF NOT EXISTS public.provider_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plaid_access_token TEXT NOT NULL,
  plaid_account_id TEXT NOT NULL,
  account_name TEXT,
  account_mask TEXT,
  bank_name TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on provider_payment_methods
ALTER TABLE public.provider_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for provider_payment_methods
CREATE POLICY "Providers can view their own payment methods"
ON public.provider_payment_methods
FOR SELECT
USING (auth.uid() = provider_id);

CREATE POLICY "Providers can insert their own payment methods"
ON public.provider_payment_methods
FOR INSERT
WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Providers can update their own payment methods"
ON public.provider_payment_methods
FOR UPDATE
USING (auth.uid() = provider_id);

CREATE POLICY "Providers can delete their own payment methods"
ON public.provider_payment_methods
FOR DELETE
USING (auth.uid() = provider_id);

CREATE POLICY "Admins can manage all payment methods"
ON public.provider_payment_methods
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_provider_payment_methods_updated_at
BEFORE UPDATE ON public.provider_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();