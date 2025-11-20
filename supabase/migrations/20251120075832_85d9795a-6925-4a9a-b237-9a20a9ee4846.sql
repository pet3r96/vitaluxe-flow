-- FIX 3: Document Download - Update Storage RLS Policy for Active Check
-- Drop existing policy
DROP POLICY IF EXISTS "Practice members can view provider documents" ON storage.objects;

-- Create improved policy with active status check
CREATE POLICY "Practice members can view provider documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'provider-documents'
  AND (
    -- Practice owner (doctor) - first folder is their user_id
    (storage.foldername(name))[1] = auth.uid()::text
    
    OR
    
    -- Provider in same practice (MUST BE ACTIVE)
    EXISTS (
      SELECT 1 FROM providers p
      WHERE p.user_id = auth.uid() 
        AND p.practice_id::text = (storage.foldername(name))[1]
        AND p.active = true
    )
    
    OR
    
    -- Staff in same practice (MUST BE ACTIVE)
    EXISTS (
      SELECT 1 FROM practice_staff ps
      WHERE ps.user_id = auth.uid()
        AND ps.practice_id::text = (storage.foldername(name))[1]
        AND ps.active = true
    )
  )
);