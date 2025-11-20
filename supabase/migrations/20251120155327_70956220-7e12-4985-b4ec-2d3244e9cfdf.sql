-- Drop existing policy if any
DROP POLICY IF EXISTS "Practice members can view provider documents" ON storage.objects;

-- Create folder-based RLS policy (not owner-based, since S3 files don't have owner)
-- This allows access based on practice_id folder structure
CREATE POLICY "Practice members can view provider documents"
ON storage.objects 
FOR SELECT
TO authenticated
USING (
  bucket_id = 'provider-documents'
  AND (
    -- Practice Owner (folder name = practice_id)
    (storage.foldername(name))[1] = auth.uid()::text

    OR

    -- Providers in same practice
    (storage.foldername(name))[1] IN (
      SELECT practice_id::text 
      FROM providers
      WHERE user_id = auth.uid() 
        AND active = true
    )

    OR

    -- Staff in same practice
    (storage.foldername(name))[1] IN (
      SELECT practice_id::text 
      FROM practice_staff
      WHERE user_id = auth.uid() 
        AND active = true
    )
  )
);