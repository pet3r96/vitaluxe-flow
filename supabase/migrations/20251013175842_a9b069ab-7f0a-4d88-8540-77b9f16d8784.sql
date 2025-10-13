-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for receipts bucket

-- Admins can access all receipts
CREATE POLICY "Admins can access all receipts"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'receipts' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Practices can access their own receipts
CREATE POLICY "Practices can access own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can insert receipts (for edge function)
CREATE POLICY "Service role can insert receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
);