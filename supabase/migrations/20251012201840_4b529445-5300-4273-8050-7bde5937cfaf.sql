-- Fix test data: Update pending practice with valid DEA numbers
UPDATE pending_practices 
SET dea = 'AB1234563',           -- Valid: 2 letters + 7 digits
    prescriber_dea = 'FP5678901'  -- Valid: 2 letters + 7 digits
WHERE id = '74ec3dac-2c62-41ca-9588-98e98ced6cce';