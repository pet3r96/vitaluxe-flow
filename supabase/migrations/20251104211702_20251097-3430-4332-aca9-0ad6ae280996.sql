-- Fix provider appointment visibility
-- The current policy incorrectly compares provider_id (providers.id) with auth.uid()
-- Need to link: auth.uid() → providers.user_id → providers.id → patient_appointments.provider_id

DROP POLICY IF EXISTS "Providers can manage their own appointments" ON patient_appointments;

CREATE POLICY "Providers can manage their own appointments"
ON patient_appointments FOR ALL
TO authenticated
USING (
  provider_id IN (
    SELECT p.id 
    FROM providers p 
    WHERE p.user_id = auth.uid() 
      AND p.active = true
  )
)
WITH CHECK (
  provider_id IN (
    SELECT p.id 
    FROM providers p 
    WHERE p.user_id = auth.uid() 
      AND p.active = true
  )
);