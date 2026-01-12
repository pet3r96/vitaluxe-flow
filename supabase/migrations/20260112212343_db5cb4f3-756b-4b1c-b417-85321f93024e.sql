-- Clear invalid Authorize.Net profile IDs that don't match numeric format
-- Authorize.Net customer profile IDs must be numeric strings
UPDATE practice_payment_methods
SET authorizenet_profile_id = NULL
WHERE authorizenet_profile_id IS NOT NULL 
  AND authorizenet_profile_id !~ '^[0-9]+$';