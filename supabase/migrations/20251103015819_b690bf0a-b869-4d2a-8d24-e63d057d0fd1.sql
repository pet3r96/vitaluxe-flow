-- Create security definer function to check practice membership
CREATE OR REPLACE FUNCTION public.user_belongs_to_patient_practice(
  _user_id UUID,
  _patient_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_practice_id UUID;
  patient_practice_id UUID;
BEGIN
  -- Get user's practice from practice_users
  SELECT practice_id INTO user_practice_id
  FROM public.practice_users
  WHERE user_id = _user_id
  LIMIT 1;
  
  -- Get patient's practice from patient_accounts
  SELECT practice_id INTO patient_practice_id
  FROM public.patient_accounts
  WHERE id = _patient_account_id
  LIMIT 1;
  
  -- Return true if both practices match and are not null
  RETURN user_practice_id IS NOT NULL 
    AND patient_practice_id IS NOT NULL 
    AND user_practice_id = patient_practice_id;
END;
$$;

-- RLS Policies for patient_conditions
CREATE POLICY "Practice users can insert conditions for their patients"
ON public.patient_conditions
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update conditions for their patients"
ON public.patient_conditions
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_medications
CREATE POLICY "Practice users can insert medications for their patients"
ON public.patient_medications
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update medications for their patients"
ON public.patient_medications
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_allergies
CREATE POLICY "Practice users can insert allergies for their patients"
ON public.patient_allergies
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update allergies for their patients"
ON public.patient_allergies
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_immunizations
CREATE POLICY "Practice users can insert immunizations for their patients"
ON public.patient_immunizations
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update immunizations for their patients"
ON public.patient_immunizations
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_surgeries
CREATE POLICY "Practice users can insert surgeries for their patients"
ON public.patient_surgeries
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update surgeries for their patients"
ON public.patient_surgeries
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_vitals
CREATE POLICY "Practice users can insert vitals for their patients"
ON public.patient_vitals
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update vitals for their patients"
ON public.patient_vitals
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_pharmacies
CREATE POLICY "Practice users can insert pharmacies for their patients"
ON public.patient_pharmacies
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update pharmacies for their patients"
ON public.patient_pharmacies
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);

-- RLS Policies for patient_emergency_contacts
CREATE POLICY "Practice users can insert emergency contacts for their patients"
ON public.patient_emergency_contacts
FOR INSERT
WITH CHECK (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
  AND added_by_user_id = auth.uid()
);

CREATE POLICY "Practice users can update emergency contacts for their patients"
ON public.patient_emergency_contacts
FOR UPDATE
USING (
  public.user_belongs_to_patient_practice(auth.uid(), patient_account_id)
);