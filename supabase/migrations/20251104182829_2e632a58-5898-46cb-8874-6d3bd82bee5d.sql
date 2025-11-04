-- Make date_administered nullable in patient_immunizations table
-- This allows users to save immunization records even if they don't know the exact date
ALTER TABLE patient_immunizations 
ALTER COLUMN date_administered DROP NOT NULL;