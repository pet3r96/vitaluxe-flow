-- Allow image files (PNG, JPG, JPEG) in addition to PDFs for prescriptions bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
WHERE id = 'prescriptions';