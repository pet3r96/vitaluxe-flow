-- Reset terms acceptance for Dr. Jennifer Martinez (provider1.emilypractice@example.com)
-- User ID: a78d664e-a6e8-45ba-9a1e-f6aff4562af8

-- Step 1: Mark terms as not accepted in user_password_status
UPDATE user_password_status
SET terms_accepted = false,
    updated_at = now()
WHERE user_id = 'a78d664e-a6e8-45ba-9a1e-f6aff4562af8';

-- Step 2: Delete the previous terms acceptance record
DELETE FROM user_terms_acceptances
WHERE id = 'd14733f9-3bf7-47cb-b1d7-6c2cd4a04b0c';