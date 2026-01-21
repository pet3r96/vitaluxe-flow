-- Create branding-assets bucket for logos and brand assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access for branding assets
CREATE POLICY "Public read access for branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding-assets');

-- Allow admins to upload branding assets
CREATE POLICY "Admins can upload branding assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding-assets' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);