-- ==========================================
-- Patient Notes & Treatment Plans Migration
-- ==========================================

-- Helper function for updated_at (reusable)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- PATIENT NOTES TABLE
-- ==========================================
CREATE TABLE public.patient_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  note_content text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_by_role text NOT NULL,
  created_by_name text NOT NULL,
  last_edited_by_user_id uuid,
  last_edited_by_name text,
  share_with_patient boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_notes_patient ON public.patient_notes(patient_account_id);
CREATE INDEX idx_patient_notes_active ON public.patient_notes(is_active);
CREATE INDEX idx_patient_notes_shared ON public.patient_notes(share_with_patient);

CREATE TRIGGER trg_patient_notes_updated_at
BEFORE UPDATE ON public.patient_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.patient_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_notes" ON public.patient_notes
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'provider'::app_role)
);

CREATE POLICY "patients_view_shared" ON public.patient_notes
FOR SELECT USING (
  share_with_patient = true AND patient_account_id = auth.uid()
);

CREATE POLICY "staff_create_notes" ON public.patient_notes
FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "creators_update_notes" ON public.patient_notes
FOR UPDATE USING (
  created_by_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "creators_delete_notes" ON public.patient_notes
FOR DELETE USING (
  created_by_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

-- ==========================================
-- TREATMENT PLANS ENUMS
-- ==========================================
DO $$ BEGIN
  CREATE TYPE public.treatment_plan_status AS ENUM ('planned','in_progress','on_hold','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.treatment_goal_status AS ENUM ('ongoing','achieved','modified','abandoned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.treatment_update_type AS ENUM ('progress_note','status_change','goal_update','treatment_completed','complication','patient_feedback','provider_note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_attachment_type AS ENUM ('before_photo','after_photo','progress_photo','consent_form','treatment_protocol','lab_result','other_document');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ==========================================
-- TREATMENT PLANS TABLE
-- ==========================================
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_account_id uuid NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  plan_title text NOT NULL,
  diagnosis_condition text,
  treatment_protocols text NOT NULL,
  responsible_provider_id uuid,
  responsible_provider_name text,
  target_completion_date timestamptz,
  actual_completion_date timestamptz,
  status public.treatment_plan_status NOT NULL DEFAULT 'planned',
  notes text,
  created_by_user_id uuid NOT NULL,
  created_by_role text NOT NULL,
  created_by_name text NOT NULL,
  last_updated_by_user_id uuid,
  last_updated_by_name text,
  is_active boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by_user_id uuid,
  locked_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans(patient_account_id);
CREATE INDEX idx_treatment_plans_active ON public.treatment_plans(is_active);
CREATE INDEX idx_treatment_plans_status ON public.treatment_plans(status);

CREATE TRIGGER trg_treatment_plans_updated_at
BEFORE UPDATE ON public.treatment_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_plans" ON public.treatment_plans
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'doctor'::app_role) OR
  has_role(auth.uid(), 'provider'::app_role)
);

CREATE POLICY "patients_read_own_plans" ON public.treatment_plans
FOR SELECT USING (patient_account_id = auth.uid());

CREATE POLICY "staff_insert_plans" ON public.treatment_plans
FOR INSERT WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "staff_update_unlocked_plans" ON public.treatment_plans
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (NOT is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role)))
);

CREATE POLICY "staff_delete_unlocked_plans" ON public.treatment_plans
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (NOT is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role)))
);

-- ==========================================
-- TREATMENT PLAN GOALS TABLE
-- ==========================================
CREATE TABLE public.treatment_plan_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  goal_description text NOT NULL,
  goal_order integer NOT NULL DEFAULT 0,
  status public.treatment_goal_status NOT NULL DEFAULT 'ongoing',
  is_specific boolean NOT NULL DEFAULT false,
  is_measurable boolean NOT NULL DEFAULT false,
  is_achievable boolean NOT NULL DEFAULT false,
  is_relevant boolean NOT NULL DEFAULT false,
  is_time_bound boolean NOT NULL DEFAULT false,
  date_achieved timestamptz,
  achievement_notes text,
  date_modified timestamptz,
  modification_reason text,
  previous_description text,
  created_by_user_id uuid NOT NULL,
  created_by_name text NOT NULL,
  last_updated_by_user_id uuid,
  last_updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_goals_plan ON public.treatment_plan_goals(treatment_plan_id);
CREATE INDEX idx_goals_active ON public.treatment_plan_goals(is_active);

CREATE TRIGGER trg_goals_updated_at
BEFORE UPDATE ON public.treatment_plan_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.treatment_plan_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_goals_if_can_read_plan" ON public.treatment_plan_goals
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'doctor'::app_role) OR
        has_role(auth.uid(), 'provider'::app_role) OR
        tp.patient_account_id = auth.uid()
      )
  )
);

CREATE POLICY "insert_goals_when_unlocked" ON public.treatment_plan_goals
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

CREATE POLICY "update_goals_when_unlocked" ON public.treatment_plan_goals
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

CREATE POLICY "delete_goals_when_unlocked" ON public.treatment_plan_goals
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

-- ==========================================
-- TREATMENT PLAN UPDATES TABLE
-- ==========================================
CREATE TABLE public.treatment_plan_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  update_type public.treatment_update_type NOT NULL,
  update_content text NOT NULL,
  previous_status text,
  new_status text,
  created_by_user_id uuid NOT NULL,
  created_by_role text NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  related_appointment_id uuid
);

CREATE INDEX idx_updates_plan ON public.treatment_plan_updates(treatment_plan_id);
CREATE INDEX idx_updates_type ON public.treatment_plan_updates(update_type);

ALTER TABLE public.treatment_plan_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_updates_if_can_read_plan" ON public.treatment_plan_updates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'doctor'::app_role) OR
        has_role(auth.uid(), 'provider'::app_role) OR
        tp.patient_account_id = auth.uid()
      )
  )
);

CREATE POLICY "insert_updates_when_unlocked" ON public.treatment_plan_updates
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

CREATE POLICY "delete_updates_when_unlocked" ON public.treatment_plan_updates
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

-- ==========================================
-- TREATMENT PLAN ATTACHMENTS TABLE
-- ==========================================
CREATE TABLE public.treatment_plan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  attachment_type public.plan_attachment_type NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  description text,
  taken_date timestamptz,
  uploaded_by_user_id uuid NOT NULL,
  uploaded_by_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_attachments_plan ON public.treatment_plan_attachments(treatment_plan_id);
CREATE INDEX idx_attachments_active ON public.treatment_plan_attachments(is_active);

ALTER TABLE public.treatment_plan_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_attachments_if_can_read_plan" ON public.treatment_plan_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'doctor'::app_role) OR
        has_role(auth.uid(), 'provider'::app_role) OR
        tp.patient_account_id = auth.uid()
      )
  )
);

CREATE POLICY "insert_attachments_when_unlocked" ON public.treatment_plan_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

CREATE POLICY "update_attachments_when_unlocked" ON public.treatment_plan_attachments
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);

CREATE POLICY "delete_attachments_when_unlocked" ON public.treatment_plan_attachments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    WHERE tp.id = treatment_plan_id
      AND (has_role(auth.uid(), 'admin'::app_role) OR (NOT tp.is_locked AND (has_role(auth.uid(), 'doctor'::app_role) OR has_role(auth.uid(), 'provider'::app_role))))
  )
);