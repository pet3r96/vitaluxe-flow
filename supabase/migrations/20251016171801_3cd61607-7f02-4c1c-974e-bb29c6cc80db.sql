-- Make plaid_access_token nullable to support both Plaid bank accounts and Authorize.Net credit cards
ALTER TABLE practice_payment_methods 
ALTER COLUMN plaid_access_token DROP NOT NULL;