-- Create dedicated table for Patient Portal Terms
CREATE TABLE IF NOT EXISTS public.patient_portal_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

-- Enable RLS
ALTER TABLE public.patient_portal_terms ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can manage patient portal terms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patient_portal_terms'
      AND policyname = 'Admins manage patient portal terms'
  ) THEN
    CREATE POLICY "Admins manage patient portal terms"
    ON public.patient_portal_terms
    FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END
$$;

-- Seed initial Patient Portal terms if table is empty
INSERT INTO public.patient_portal_terms (title, content, version)
SELECT 'Patient Portal Terms & Conditions',
       $$PATIENT PORTAL TERMS & CONDITIONS

(Effective Upon Electronic Acceptance)

These Terms & Conditions ("Agreement") govern your use of the VitaLuxe patient portal ("Portal"). By accessing or using the Portal, you agree to the following:

1. PURPOSE OF THE PORTAL
- The Portal allows you to view messages, documents, and information shared with you by your care team and to communicate with authorized personnel.
- The Portal is not a substitute for medical advice, diagnosis, or treatment. For emergencies, call 911 immediately.

2. YOUR RESPONSIBILITIES
- You agree to keep your login credentials confidential and secure.
- Information you submit must be accurate and truthful. You are responsible for activity conducted under your account.

3. PRIVACY & SECURITY
- Your information is protected in accordance with applicable privacy laws. For details on how your data is used and protected, refer to our Privacy Notice.
- Do not share protected health information (PHI) beyond what is necessary through unsecured channels.

4. COMMUNICATIONS
- Messages through the Portal may be monitored and become part of your medical record when appropriate.
- Response times may vary and are not intended for urgent communications.

5. LIMITATIONS & AVAILABILITY
- The Portal is provided on an "as-is" and "as-available" basis. Access may be interrupted for maintenance or other reasons.
- VitaLuxe is not liable for damages arising from your use of or inability to use the Portal, except as prohibited by law.

6. INTELLECTUAL PROPERTY
- All Portal content and software are owned by VitaLuxe Services, LLC or its licensors and are protected by law. You receive a limited, revocable license to use the Portal for personal, lawful purposes.

7. TERMINATION
- We may suspend or terminate Portal access for misuse, suspected fraud, security risks, or violation of this Agreement.

8. ACCEPTANCE
By clicking “I Agree” or continuing to use the Portal, you confirm you understand and accept these Terms & Conditions.$$,
       1
WHERE NOT EXISTS (SELECT 1 FROM public.patient_portal_terms);
