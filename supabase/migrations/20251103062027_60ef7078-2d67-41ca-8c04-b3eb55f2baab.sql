BEGIN;

-- Ensure RLS is enabled on all medical vault tables
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_immunizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Patient Medications
DROP POLICY IF EXISTS "Practice members can view patient_medications" ON public.patient_medications;
CREATE POLICY "Practice members can view patient_medications"
ON public.patient_medications FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_medications" ON public.patient_medications;
CREATE POLICY "Practice members can delete patient_medications"
ON public.patient_medications FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Conditions
DROP POLICY IF EXISTS "Practice members can view patient_conditions" ON public.patient_conditions;
CREATE POLICY "Practice members can view patient_conditions"
ON public.patient_conditions FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_conditions" ON public.patient_conditions;
CREATE POLICY "Practice members can delete patient_conditions"
ON public.patient_conditions FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Allergies
DROP POLICY IF EXISTS "Practice members can view patient_allergies" ON public.patient_allergies;
CREATE POLICY "Practice members can view patient_allergies"
ON public.patient_allergies FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_allergies" ON public.patient_allergies;
CREATE POLICY "Practice members can delete patient_allergies"
ON public.patient_allergies FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Vitals
DROP POLICY IF EXISTS "Practice members can view patient_vitals" ON public.patient_vitals;
CREATE POLICY "Practice members can view patient_vitals"
ON public.patient_vitals FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_vitals" ON public.patient_vitals;
CREATE POLICY "Practice members can delete patient_vitals"
ON public.patient_vitals FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Immunizations
DROP POLICY IF EXISTS "Practice members can view patient_immunizations" ON public.patient_immunizations;
CREATE POLICY "Practice members can view patient_immunizations"
ON public.patient_immunizations FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_immunizations" ON public.patient_immunizations;
CREATE POLICY "Practice members can delete patient_immunizations"
ON public.patient_immunizations FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Surgeries
DROP POLICY IF EXISTS "Practice members can view patient_surgeries" ON public.patient_surgeries;
CREATE POLICY "Practice members can view patient_surgeries"
ON public.patient_surgeries FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_surgeries" ON public.patient_surgeries;
CREATE POLICY "Practice members can delete patient_surgeries"
ON public.patient_surgeries FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Pharmacies
DROP POLICY IF EXISTS "Practice members can view patient_pharmacies" ON public.patient_pharmacies;
CREATE POLICY "Practice members can view patient_pharmacies"
ON public.patient_pharmacies FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_pharmacies" ON public.patient_pharmacies;
CREATE POLICY "Practice members can delete patient_pharmacies"
ON public.patient_pharmacies FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

-- Patient Emergency Contacts
DROP POLICY IF EXISTS "Practice members can view patient_emergency_contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Practice members can view patient_emergency_contacts"
ON public.patient_emergency_contacts FOR SELECT TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

DROP POLICY IF EXISTS "Practice members can delete patient_emergency_contacts" ON public.patient_emergency_contacts;
CREATE POLICY "Practice members can delete patient_emergency_contacts"
ON public.patient_emergency_contacts FOR DELETE TO authenticated
USING (public.user_belongs_to_patient_practice(auth.uid(), patient_account_id));

COMMIT;