-- Change associated_provider_id from UUID to TEXT to allow provider names
-- First, drop the column and recreate it as text (since we can't directly convert UUID to TEXT with data)
ALTER TABLE patient_conditions DROP COLUMN IF EXISTS associated_provider_id;
ALTER TABLE patient_conditions ADD COLUMN associated_provider TEXT;