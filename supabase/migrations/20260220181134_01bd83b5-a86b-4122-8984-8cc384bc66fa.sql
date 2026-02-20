
-- ============================================================
-- Fix: Change all blocking NO ACTION foreign keys to SET NULL or CASCADE
-- so that user deletion is no longer blocked by referencing rows.
-- ============================================================

-- === auth.users references (16 constraints) → SET NULL ===

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_cancelled_by_fkey;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_cancelled_by_fkey
  FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.patient_documents
  DROP CONSTRAINT IF EXISTS patient_documents_uploaded_by_fkey;
ALTER TABLE public.patient_documents
  ADD CONSTRAINT patient_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.provider_documents
  DROP CONSTRAINT IF EXISTS provider_documents_uploaded_by_fkey;
ALTER TABLE public.provider_documents
  ADD CONSTRAINT provider_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.provider_document_assignments
  DROP CONSTRAINT IF EXISTS provider_document_assignments_created_by_fkey;
ALTER TABLE public.provider_document_assignments
  ADD CONSTRAINT provider_document_assignments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.terms_and_conditions
  DROP CONSTRAINT IF EXISTS terms_and_conditions_created_by_fkey;
ALTER TABLE public.terms_and_conditions
  ADD CONSTRAINT terms_and_conditions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.terms_and_conditions
  DROP CONSTRAINT IF EXISTS terms_and_conditions_updated_by_fkey;
ALTER TABLE public.terms_and_conditions
  ADD CONSTRAINT terms_and_conditions_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.prescription_refills
  DROP CONSTRAINT IF EXISTS prescription_refills_refilled_by_fkey;
ALTER TABLE public.prescription_refills
  ADD CONSTRAINT prescription_refills_refilled_by_fkey
  FOREIGN KEY (refilled_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_2fa_settings
  DROP CONSTRAINT IF EXISTS user_2fa_settings_reset_requested_by_fkey;
ALTER TABLE public.user_2fa_settings
  ADD CONSTRAINT user_2fa_settings_reset_requested_by_fkey
  FOREIGN KEY (reset_requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;
ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.video_session_guest_links
  DROP CONSTRAINT IF EXISTS video_session_guest_links_created_by_fkey;
ALTER TABLE public.video_session_guest_links
  ADD CONSTRAINT video_session_guest_links_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.checkout_attestation
  DROP CONSTRAINT IF EXISTS checkout_attestation_updated_by_fkey;
ALTER TABLE public.checkout_attestation
  ADD CONSTRAINT checkout_attestation_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.patient_portal_terms
  DROP CONSTRAINT IF EXISTS patient_portal_terms_updated_by_fkey;
ALTER TABLE public.patient_portal_terms
  ADD CONSTRAINT patient_portal_terms_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.provider_document_patients
  DROP CONSTRAINT IF EXISTS provider_document_patients_assigned_by_fkey;
ALTER TABLE public.provider_document_patients
  ADD CONSTRAINT provider_document_patients_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.video_usage_pricing
  DROP CONSTRAINT IF EXISTS video_usage_pricing_created_by_fkey;
ALTER TABLE public.video_usage_pricing
  ADD CONSTRAINT video_usage_pricing_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pharmacy_order_transmissions
  DROP CONSTRAINT IF EXISTS pharmacy_order_transmissions_retried_by_fkey;
ALTER TABLE public.pharmacy_order_transmissions
  ADD CONSTRAINT pharmacy_order_transmissions_retried_by_fkey
  FOREIGN KEY (retried_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.video_sessions
  DROP CONSTRAINT IF EXISTS video_sessions_created_by_user_id_fkey;
ALTER TABLE public.video_sessions
  ADD CONSTRAINT video_sessions_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- === pharmacies references (5 constraints) ===

ALTER TABLE public.order_lines
  DROP CONSTRAINT IF EXISTS order_lines_assigned_pharmacy_id_fkey;
ALTER TABLE public.order_lines
  ADD CONSTRAINT order_lines_assigned_pharmacy_id_fkey
  FOREIGN KEY (assigned_pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE SET NULL;

ALTER TABLE public.cart_lines
  DROP CONSTRAINT IF EXISTS cart_lines_assigned_pharmacy_id_fkey;
ALTER TABLE public.cart_lines
  ADD CONSTRAINT cart_lines_assigned_pharmacy_id_fkey
  FOREIGN KEY (assigned_pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE SET NULL;

ALTER TABLE public.pharmacy_webhook_events
  DROP CONSTRAINT IF EXISTS pharmacy_webhook_events_pharmacy_id_fkey;
ALTER TABLE public.pharmacy_webhook_events
  ADD CONSTRAINT pharmacy_webhook_events_pharmacy_id_fkey
  FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE SET NULL;

ALTER TABLE public.pharmacy_shipping_rates
  DROP CONSTRAINT IF EXISTS pharmacy_shipping_rates_pharmacy_id_fkey;
ALTER TABLE public.pharmacy_shipping_rates
  ADD CONSTRAINT pharmacy_shipping_rates_pharmacy_id_fkey
  FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE CASCADE;

ALTER TABLE public.pharmacy_order_jobs
  DROP CONSTRAINT IF EXISTS pharmacy_order_jobs_pharmacy_id_fkey;
ALTER TABLE public.pharmacy_order_jobs
  ADD CONSTRAINT pharmacy_order_jobs_pharmacy_id_fkey
  FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE CASCADE;
