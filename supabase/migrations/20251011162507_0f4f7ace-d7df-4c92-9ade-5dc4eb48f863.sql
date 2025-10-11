-- Clean up corrupted data for "test te37" practice account
-- Remove the provider role from test te37
DELETE FROM user_roles 
WHERE user_id = 'df2d1dca-abc2-4855-ba9b-c278933d729c' 
AND role = 'provider';

-- Remove the self-referencing providers record
DELETE FROM providers 
WHERE user_id = 'df2d1dca-abc2-4855-ba9b-c278933d729c' 
AND practice_id = 'df2d1dca-abc2-4855-ba9b-c278933d729c';