-- Fix internal_messages priority constraint to accept 'medium' instead of 'normal'
-- This resolves the issue where staff cannot send internal messages

-- Drop old constraint
ALTER TABLE internal_messages 
  DROP CONSTRAINT IF EXISTS internal_messages_priority_check;

-- Add new constraint with 'medium' instead of 'normal'
ALTER TABLE internal_messages 
  ADD CONSTRAINT internal_messages_priority_check 
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));