-- Phase 1: Storage & File Management

-- =============================================
-- 1. CREATE STORAGE BUCKETS
-- =============================================

-- Create contracts bucket for Vitaluxe Services Forms & contracts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Create prescriptions bucket for prescription uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Create product-images bucket for product sample pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true, -- Public so product images can be displayed
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
);

-- =============================================
-- 2. STORAGE RLS POLICIES - CONTRACTS BUCKET
-- =============================================

-- Admins can view all contracts
CREATE POLICY "Admins can view all contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can upload contracts
CREATE POLICY "Admins can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete contracts
CREATE POLICY "Admins can delete contracts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Users can view their own contracts
CREATE POLICY "Users can view their own contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================
-- 3. STORAGE RLS POLICIES - PRESCRIPTIONS BUCKET
-- =============================================

-- Admins can view all prescriptions
CREATE POLICY "Admins can view all prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Doctors can upload prescriptions
CREATE POLICY "Doctors can upload prescriptions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'prescriptions' 
  AND has_role(auth.uid(), 'doctor'::app_role)
);

-- Doctors can view their own prescriptions
CREATE POLICY "Doctors can view their own prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role(auth.uid(), 'doctor'::app_role)
);

-- Pharmacies can view prescriptions for their assigned orders
CREATE POLICY "Pharmacies can view assigned prescriptions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'prescriptions' 
  AND has_role(auth.uid(), 'pharmacy'::app_role)
  AND EXISTS (
    SELECT 1 FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    JOIN pharmacies p ON p.id = ol.assigned_pharmacy_id
    WHERE ol.prescription_url = name
  )
);

-- =============================================
-- 4. STORAGE RLS POLICIES - PRODUCT-IMAGES BUCKET
-- =============================================

-- Everyone can view product images (public bucket)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Admins can upload product images
CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update product images
CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete product images
CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- =============================================
-- 5. CREATE DOCUMENTS TABLE
-- =============================================

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'form', 'prescription', 'other')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Admins can view all documents
CREATE POLICY "Admins can view all documents"
ON public.documents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON public.documents FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own documents
CREATE POLICY "Users can view their own documents"
ON public.documents FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
ON public.documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_type ON public.documents(document_type);

-- =============================================
-- 6. ADD CONTRACT URL TO PROFILES
-- =============================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS contract_url TEXT;

-- =============================================
-- 7. CREATE STATUSES TABLE
-- =============================================

CREATE TABLE public.statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  applicable_roles TEXT[] NOT NULL DEFAULT '{}',
  color TEXT DEFAULT '#3b82f6',
  order_position INTEGER,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active statuses
CREATE POLICY "Authenticated users can view active statuses"
ON public.statuses FOR SELECT
USING (active = true);

-- Admins can manage statuses
CREATE POLICY "Admins can manage statuses"
ON public.statuses FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_statuses_active ON public.statuses(active);
CREATE INDEX idx_statuses_order ON public.statuses(order_position);

-- Add trigger for updated_at
CREATE TRIGGER update_statuses_updated_at
BEFORE UPDATE ON public.statuses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 8. INSERT DEFAULT STATUSES
-- =============================================

INSERT INTO public.statuses (name, applicable_roles, color, order_position) VALUES
  ('Pending', ARRAY['doctor', 'pharmacy'], '#f59e0b', 1),
  ('Processing', ARRAY['pharmacy'], '#3b82f6', 2),
  ('Filled', ARRAY['pharmacy'], '#8b5cf6', 3),
  ('Shipped', ARRAY['pharmacy'], '#06b6d4', 4),
  ('Delivered', ARRAY['pharmacy'], '#10b981', 5),
  ('Cancelled', ARRAY['doctor', 'pharmacy'], '#ef4444', 6),
  ('On Hold', ARRAY['pharmacy'], '#f97316', 7);