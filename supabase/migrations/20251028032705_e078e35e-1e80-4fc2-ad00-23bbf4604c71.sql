-- ====================================================================
-- VITALUXEPRO SUBSCRIPTION SYSTEM - COMPLETE DATABASE SCHEMA
-- ====================================================================
-- This migration creates all 15 tables needed for the VitaLuxePro
-- subscription system, patient portal, and practice management features
-- ====================================================================

-- ====================================================================
-- TABLE 1: practice_subscriptions
-- Stores subscription status, trial info, and billing dates for practices
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.practice_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'suspended')),
  trial_start_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  monthly_price DECIMAL(10,2) DEFAULT 99.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(practice_id)
);

CREATE INDEX idx_practice_subscriptions_practice_id ON public.practice_subscriptions(practice_id);
CREATE INDEX idx_practice_subscriptions_status ON public.practice_subscriptions(status);

-- RLS Policies for practice_subscriptions
ALTER TABLE public.practice_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all subscriptions"
  ON public.practice_subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their own subscription"
  ON public.practice_subscriptions FOR SELECT
  USING (practice_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_practice_subscriptions_updated_at
  BEFORE UPDATE ON public.practice_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 2: subscription_payments
-- Payment history for subscriptions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.practice_subscriptions(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method TEXT,
  transaction_id TEXT,
  error_message TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_subscription_payments_subscription_id ON public.subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_practice_id ON public.subscription_payments(practice_id);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(payment_status);

-- RLS Policies for subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all subscription payments"
  ON public.subscription_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their own payments"
  ON public.subscription_payments FOR SELECT
  USING (practice_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 3: rep_subscription_commissions
-- Rep commission tracking for subscriptions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.rep_subscription_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES public.reps(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.practice_subscriptions(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('initial', 'recurring', 'bonus')),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  paid_out BOOLEAN DEFAULT false,
  paid_out_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_rep_subscription_commissions_rep_id ON public.rep_subscription_commissions(rep_id);
CREATE INDEX idx_rep_subscription_commissions_practice_id ON public.rep_subscription_commissions(practice_id);
CREATE INDEX idx_rep_subscription_commissions_subscription_id ON public.rep_subscription_commissions(subscription_id);

-- RLS Policies for rep_subscription_commissions
ALTER TABLE public.rep_subscription_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all commissions"
  ON public.rep_subscription_commissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reps can view their own commissions"
  ON public.rep_subscription_commissions FOR SELECT
  USING (rep_id = get_current_user_rep_id());

-- Trigger for updated_at
CREATE TRIGGER update_rep_subscription_commissions_updated_at
  BEFORE UPDATE ON public.rep_subscription_commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 4: subscription_upgrade_prompts
-- Tracks when upgrade prompts were shown (already referenced in code)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.subscription_upgrade_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_shown_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  times_shown INTEGER DEFAULT 1,
  dismissed_permanently BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(practice_id)
);

CREATE INDEX idx_subscription_upgrade_prompts_practice_id ON public.subscription_upgrade_prompts(practice_id);

-- RLS Policies for subscription_upgrade_prompts
ALTER TABLE public.subscription_upgrade_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practices can manage their own prompts"
  ON public.subscription_upgrade_prompts FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

CREATE POLICY "System can insert prompts"
  ON public.subscription_upgrade_prompts FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_subscription_upgrade_prompts_updated_at
  BEFORE UPDATE ON public.subscription_upgrade_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 5: patient_accounts
-- Patient user accounts linked to practices
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_accounts_user_id ON public.patient_accounts(user_id);
CREATE INDEX idx_patient_accounts_practice_id ON public.patient_accounts(practice_id);
CREATE INDEX idx_patient_accounts_email ON public.patient_accounts(email);

-- RLS Policies for patient_accounts
ALTER TABLE public.patient_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all patient accounts"
  ON public.patient_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their patients"
  ON public.patient_accounts FOR SELECT
  USING (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Patients can view their own account"
  ON public.patient_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Patients can update their own account"
  ON public.patient_accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_patient_accounts_updated_at
  BEFORE UPDATE ON public.patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 6: patient_medical_vault
-- Patient medical records and health data
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_medical_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('allergy', 'medication', 'condition', 'procedure', 'immunization', 'lab_result', 'vital_sign', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  date_recorded DATE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_medical_vault_patient_id ON public.patient_medical_vault(patient_id);
CREATE INDEX idx_patient_medical_vault_record_type ON public.patient_medical_vault(record_type);

-- RLS Policies for patient_medical_vault
ALTER TABLE public.patient_medical_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all medical vault records"
  ON public.patient_medical_vault FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients can view their own medical vault"
  ON public.patient_medical_vault FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Providers can view their practice patients' vault"
  ON public.patient_medical_vault FOR SELECT
  USING (patient_id IN (
    SELECT pa.id FROM public.patient_accounts pa
    JOIN public.providers p ON p.practice_id = pa.practice_id
    WHERE p.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_patient_medical_vault_updated_at
  BEFORE UPDATE ON public.patient_medical_vault
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 7: patient_documents
-- Patient uploaded documents
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('insurance_card', 'id_card', 'prescription', 'lab_result', 'medical_record', 'consent_form', 'other')),
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX idx_patient_documents_document_type ON public.patient_documents(document_type);

-- RLS Policies for patient_documents
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all patient documents"
  ON public.patient_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients can manage their own documents"
  ON public.patient_documents FOR ALL
  USING (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()))
  WITH CHECK (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Providers can view their practice patients' documents"
  ON public.patient_documents FOR SELECT
  USING (patient_id IN (
    SELECT pa.id FROM public.patient_accounts pa
    JOIN public.providers p ON p.practice_id = pa.practice_id
    WHERE p.user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_patient_documents_updated_at
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 8: patient_appointments
-- Appointment scheduling system
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('consultation', 'follow_up', 'procedure', 'telehealth', 'other')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_appointments_patient_id ON public.patient_appointments(patient_id);
CREATE INDEX idx_patient_appointments_practice_id ON public.patient_appointments(practice_id);
CREATE INDEX idx_patient_appointments_provider_id ON public.patient_appointments(provider_id);
CREATE INDEX idx_patient_appointments_start_time ON public.patient_appointments(start_time);
CREATE INDEX idx_patient_appointments_status ON public.patient_appointments(status);

-- RLS Policies for patient_appointments
ALTER TABLE public.patient_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all appointments"
  ON public.patient_appointments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients can view their own appointments"
  ON public.patient_appointments FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Practices can manage their appointments"
  ON public.patient_appointments FOR ALL
  USING (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ))
  WITH CHECK (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_patient_appointments_updated_at
  BEFORE UPDATE ON public.patient_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 9: patient_messages
-- Patient-provider messaging
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patient', 'provider', 'staff')),
  subject TEXT NOT NULL,
  message_body TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  parent_message_id UUID REFERENCES public.patient_messages(id) ON DELETE CASCADE,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_messages_patient_id ON public.patient_messages(patient_id);
CREATE INDEX idx_patient_messages_practice_id ON public.patient_messages(practice_id);
CREATE INDEX idx_patient_messages_sender_id ON public.patient_messages(sender_id);
CREATE INDEX idx_patient_messages_parent_id ON public.patient_messages(parent_message_id);

-- RLS Policies for patient_messages
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all patient messages"
  ON public.patient_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients can view their own messages"
  ON public.patient_messages FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Patients can send messages"
  ON public.patient_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Practices can manage their patient messages"
  ON public.patient_messages FOR ALL
  USING (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ))
  WITH CHECK (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_patient_messages_updated_at
  BEFORE UPDATE ON public.patient_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 10: patient_triage_submissions
-- AI triage form submissions
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.patient_triage_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symptoms JSONB NOT NULL,
  ai_assessment JSONB,
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'emergency')),
  recommended_action TEXT,
  reviewed_by UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  provider_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_patient_triage_patient_id ON public.patient_triage_submissions(patient_id);
CREATE INDEX idx_patient_triage_practice_id ON public.patient_triage_submissions(practice_id);
CREATE INDEX idx_patient_triage_urgency ON public.patient_triage_submissions(urgency_level);

-- RLS Policies for patient_triage_submissions
ALTER TABLE public.patient_triage_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all triage submissions"
  ON public.patient_triage_submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Patients can view their own triage submissions"
  ON public.patient_triage_submissions FOR SELECT
  USING (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Patients can create triage submissions"
  ON public.patient_triage_submissions FOR INSERT
  WITH CHECK (patient_id IN (SELECT id FROM public.patient_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Practices can manage their triage submissions"
  ON public.patient_triage_submissions FOR ALL
  USING (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ))
  WITH CHECK (practice_id = auth.uid() OR practice_id IN (
    SELECT practice_id FROM public.providers WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_patient_triage_submissions_updated_at
  BEFORE UPDATE ON public.patient_triage_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 11: practice_calendar_hours
-- Practice operating hours
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.practice_calendar_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(practice_id, day_of_week)
);

CREATE INDEX idx_practice_calendar_hours_practice_id ON public.practice_calendar_hours(practice_id);

-- RLS Policies for practice_calendar_hours
ALTER TABLE public.practice_calendar_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all calendar hours"
  ON public.practice_calendar_hours FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can manage their own calendar"
  ON public.practice_calendar_hours FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

CREATE POLICY "Anyone can view practice hours"
  ON public.practice_calendar_hours FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_practice_calendar_hours_updated_at
  BEFORE UPDATE ON public.practice_calendar_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 12: provider_schedules
-- Individual provider availability
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.provider_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 30,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_provider_schedules_provider_id ON public.provider_schedules(provider_id);
CREATE INDEX idx_provider_schedules_day_of_week ON public.provider_schedules(day_of_week);

-- RLS Policies for provider_schedules
ALTER TABLE public.provider_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all provider schedules"
  ON public.provider_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Providers can manage their own schedule"
  ON public.provider_schedules FOR ALL
  USING (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid()));

CREATE POLICY "Practices can view their providers' schedules"
  ON public.provider_schedules FOR SELECT
  USING (provider_id IN (
    SELECT id FROM public.providers WHERE practice_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_provider_schedules_updated_at
  BEFORE UPDATE ON public.provider_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 13: practice_forms
-- Custom intake/consent forms
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.practice_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  form_name TEXT NOT NULL,
  form_type TEXT NOT NULL CHECK (form_type IN ('intake', 'consent', 'medical_history', 'custom')),
  form_schema JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_practice_forms_practice_id ON public.practice_forms(practice_id);
CREATE INDEX idx_practice_forms_form_type ON public.practice_forms(form_type);

-- RLS Policies for practice_forms
ALTER TABLE public.practice_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all practice forms"
  ON public.practice_forms FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can manage their own forms"
  ON public.practice_forms FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

CREATE POLICY "Patients can view active required forms"
  ON public.practice_forms FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_practice_forms_updated_at
  BEFORE UPDATE ON public.practice_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 14: practice_automation_settings
-- Practice workflow automation config
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.practice_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  auto_appointment_reminders BOOLEAN DEFAULT true,
  reminder_hours_before INTEGER DEFAULT 24,
  auto_followup_messages BOOLEAN DEFAULT false,
  ai_triage_enabled BOOLEAN DEFAULT true,
  auto_prescription_renewals BOOLEAN DEFAULT false,
  settings_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(practice_id)
);

CREATE INDEX idx_practice_automation_practice_id ON public.practice_automation_settings(practice_id);

-- RLS Policies for practice_automation_settings
ALTER TABLE public.practice_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all automation settings"
  ON public.practice_automation_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can manage their own automation settings"
  ON public.practice_automation_settings FOR ALL
  USING (practice_id = auth.uid())
  WITH CHECK (practice_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_practice_automation_settings_updated_at
  BEFORE UPDATE ON public.practice_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABLE 15: practice_metrics_snapshot
-- Daily metrics tracking
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.practice_metrics_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_patients INTEGER DEFAULT 0,
  active_patients INTEGER DEFAULT 0,
  new_patients INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  completed_appointments INTEGER DEFAULT 0,
  cancelled_appointments INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  unread_messages INTEGER DEFAULT 0,
  triage_submissions INTEGER DEFAULT 0,
  high_urgency_triages INTEGER DEFAULT 0,
  metrics_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(practice_id, snapshot_date)
);

CREATE INDEX idx_practice_metrics_practice_id ON public.practice_metrics_snapshot(practice_id);
CREATE INDEX idx_practice_metrics_snapshot_date ON public.practice_metrics_snapshot(snapshot_date);

-- RLS Policies for practice_metrics_snapshot
ALTER TABLE public.practice_metrics_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all metrics"
  ON public.practice_metrics_snapshot FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Practices can view their own metrics"
  ON public.practice_metrics_snapshot FOR SELECT
  USING (practice_id = auth.uid());

CREATE POLICY "System can insert metrics"
  ON public.practice_metrics_snapshot FOR INSERT
  WITH CHECK (true);

-- ====================================================================
-- HELPER FUNCTION: Create subscription for practice
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_practice_subscription(
  p_practice_id UUID,
  p_start_trial BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_trial_start TIMESTAMP WITH TIME ZONE;
  v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
  IF p_start_trial THEN
    v_trial_start := now();
    v_trial_end := now() + INTERVAL '7 days';
  END IF;

  INSERT INTO public.practice_subscriptions (
    practice_id,
    status,
    trial_start_at,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    p_practice_id,
    CASE WHEN p_start_trial THEN 'trial' ELSE 'active' END,
    v_trial_start,
    v_trial_end,
    COALESCE(v_trial_end, now()),
    COALESCE(v_trial_end, now()) + INTERVAL '30 days'
  )
  ON CONFLICT (practice_id) DO UPDATE SET
    status = EXCLUDED.status,
    trial_start_at = EXCLUDED.trial_start_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    updated_at = now()
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

-- ====================================================================
-- END OF MIGRATION
-- ====================================================================