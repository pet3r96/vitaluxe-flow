-- Fix test data: Update pending practice with valid 10-digit prescriber phone
UPDATE pending_practices 
SET prescriber_phone = '5617778888'  -- Valid: exactly 10 digits
WHERE id = '74ec3dac-2c62-41ca-9588-98e98ced6cce';