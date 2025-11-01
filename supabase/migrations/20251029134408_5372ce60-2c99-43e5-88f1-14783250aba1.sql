-- Create practice_branding table for storing custom logos
CREATE TABLE IF NOT EXISTS public.practice_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(practice_id)
);

-- Enable RLS
ALTER TABLE public.practice_branding ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own practice branding
CREATE POLICY "Users can view their own practice branding"
  ON public.practice_branding
  FOR SELECT
  USING (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own practice branding
CREATE POLICY "Users can insert their own practice branding"
  ON public.practice_branding
  FOR INSERT
  WITH CHECK (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update their own practice branding
CREATE POLICY "Users can update their own practice branding"
  ON public.practice_branding
  FOR UPDATE
  USING (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own practice branding
CREATE POLICY "Users can delete their own practice branding"
  ON public.practice_branding
  FOR DELETE
  USING (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_practice_branding_practice_id ON public.practice_branding(practice_id);

-- Add trigger for updated_at
CREATE TRIGGER update_practice_branding_updated_at
  BEFORE UPDATE ON public.practice_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();