-- Update the prescriptions bucket to allow text/plain and application/pdf
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['text/plain', 'application/pdf']
WHERE name = 'prescriptions';