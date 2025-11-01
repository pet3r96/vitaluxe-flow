-- Create audit log table for medical vault changes
CREATE TABLE public.medical_vault_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('created', 'updated', 'deleted', 'pre_intake_completed')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('medication', 'condition', 'allergy', 'vital', 'immunization', 'surgery', 'pharmacy', 'emergency_contact', 'demographics', 'pre_intake_form')),
  entity_id UUID,
  entity_name TEXT,
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_role TEXT CHECK (changed_by_role IN ('patient', 'doctor', 'staff', 'provider')),
  old_data JSONB,
  new_data JSONB,
  change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medical_vault_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit logs for their own patient accounts
CREATE POLICY "Users can view own audit logs"
ON public.medical_vault_audit_logs
FOR SELECT
USING (
  patient_account_id IN (
    SELECT id FROM public.patient_accounts 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Practice staff can view audit logs for patients in their practice  
CREATE POLICY "Practice staff can view patient audit logs"
ON public.medical_vault_audit_logs
FOR SELECT
USING (
  patient_account_id IN (
    SELECT pa.id FROM public.patient_accounts pa
    INNER JOIN public.practice_staff ps ON pa.practice_id = ps.practice_id
    WHERE ps.user_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.medical_vault_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for faster queries
CREATE INDEX idx_mv_audit_patient_account ON public.medical_vault_audit_logs(patient_account_id);
CREATE INDEX idx_mv_audit_created_at ON public.medical_vault_audit_logs(created_at DESC);
CREATE INDEX idx_mv_audit_entity_type ON public.medical_vault_audit_logs(entity_type);