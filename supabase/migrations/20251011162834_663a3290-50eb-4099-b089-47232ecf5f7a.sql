-- Bulk cleanup: Remove corrupted provider data from practice accounts
-- This fixes accounts that have self-referencing providers records

-- Step 1: Remove provider roles from accounts with self-referencing providers records
DELETE FROM user_roles
WHERE role = 'provider'
AND user_id IN (
  SELECT user_id 
  FROM providers 
  WHERE user_id = practice_id
);

-- Step 2: Delete all self-referencing providers records
DELETE FROM providers
WHERE user_id = practice_id;