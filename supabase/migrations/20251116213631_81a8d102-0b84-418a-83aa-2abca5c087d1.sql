-- Create 7 missing tables for type safety
-- Non-breaking: uses CREATE TABLE IF NOT EXISTS

-- 1) patient_notes
CREATE TABLE IF NOT EXISTS public.patient_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id),
  note_content TEXT NOT NULL,
  share_with_patient BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_by_name TEXT,
  created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) patient_follow_ups
CREATE TABLE IF NOT EXISTS public.patient_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id),
  practice_id UUID NOT NULL REFERENCES public.profiles(id),
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3) medical_vault_share_links
CREATE TABLE IF NOT EXISTS public.medical_vault_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id),
  share_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4) pharmacy_shipping_rates
CREATE TABLE IF NOT EXISTS public.pharmacy_shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id),
  shipping_speed TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5) practice_automation_settings
CREATE TABLE IF NOT EXISTS public.practice_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id),
  enable_email_notifications BOOLEAN DEFAULT true,
  enable_sms_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6) message_thread_read_status
CREATE TABLE IF NOT EXISTS public.message_thread_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  last_read_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7) medical_vault_audit_logs
CREATE TABLE IF NOT EXISTS public.medical_vault_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id),
  action_type TEXT NOT NULL,
  record_id UUID,
  changed_by UUID REFERENCES public.profiles(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.patient_notes IS 'Patient clinical notes with sharing capabilities';
COMMENT ON TABLE public.patient_follow_ups IS 'Patient follow-up tasks and reminders';
COMMENT ON TABLE public.medical_vault_share_links IS 'Secure share links for medical vault access';
COMMENT ON TABLE public.pharmacy_shipping_rates IS 'Pharmacy-specific shipping rates by speed';
COMMENT ON TABLE public.practice_automation_settings IS 'Practice-level notification automation settings';
COMMENT ON TABLE public.message_thread_read_status IS 'Message thread read tracking for users';
COMMENT ON TABLE public.medical_vault_audit_logs IS 'Audit trail for medical vault record changes';