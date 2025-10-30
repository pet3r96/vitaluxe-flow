-- Fix provider-documents storage RLS by removing conflicting broad policies
-- These broad policies conflict with the specific path-based policies and break document access

-- Drop the overly broad policies that are causing conflicts
DROP POLICY IF EXISTS "Practices can upload provider documents" ON storage.objects;
DROP POLICY IF EXISTS "Practices can view provider documents" ON storage.objects;

-- The remaining specific policies (Provider documents storage select/insert/update/delete)
-- already handle proper access control with path prefix checking and will continue to work