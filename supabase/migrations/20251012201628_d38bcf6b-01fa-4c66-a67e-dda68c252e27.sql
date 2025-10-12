-- Fix test data: Update pending practice with valid 10-digit NPIs
UPDATE pending_practices 
SET npi = '1234567890', 
    prescriber_npi = '0987654321' 
WHERE id = '74ec3dac-2c62-41ca-9588-98e98ced6cce';