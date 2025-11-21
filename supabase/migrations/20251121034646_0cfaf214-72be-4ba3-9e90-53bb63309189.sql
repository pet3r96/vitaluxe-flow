-- Remove conflicting phone format constraints that interfere with encryption
-- The plaintext patient_phone field becomes a placeholder after encryption,
-- so format validation on it is meaningless. The actual phone data is in
-- patient_phone_encrypted (validated before encryption).

ALTER TABLE cart_lines DROP CONSTRAINT IF EXISTS patient_phone_format_check;
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS patient_phone_format_check;