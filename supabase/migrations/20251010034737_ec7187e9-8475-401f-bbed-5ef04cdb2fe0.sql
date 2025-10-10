-- Create providers table
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on providers table
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for providers table
CREATE POLICY "Admins can view all providers"
  ON public.providers
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their own providers"
  ON public.providers
  FOR SELECT
  USING (
    practice_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Providers can view their own record"
  ON public.providers
  FOR SELECT
  USING (
    user_id = auth.uid() 
    OR practice_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can insert providers"
  ON public.providers
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can insert their own providers"
  ON public.providers
  FOR INSERT
  WITH CHECK (
    practice_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update providers"
  ON public.providers
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can update their own providers"
  ON public.providers
  FOR UPDATE
  USING (
    practice_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Providers can update their own record"
  ON public.providers
  FOR UPDATE
  USING (
    user_id = auth.uid() 
    OR practice_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_providers_practice_id ON public.providers(practice_id);
CREATE INDEX idx_providers_user_id ON public.providers(user_id);
CREATE INDEX idx_providers_active ON public.providers(active);