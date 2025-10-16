-- Make plaid_account_id nullable to support Authorize.Net credit cards
-- Credit cards don't use Plaid, so they won't have a plaid_account_id
ALTER TABLE practice_payment_methods 
ALTER COLUMN plaid_account_id DROP NOT NULL;