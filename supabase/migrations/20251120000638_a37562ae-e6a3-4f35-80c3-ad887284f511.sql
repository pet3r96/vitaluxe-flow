-- Clean up orphaned internal_message_recipients records
DELETE FROM internal_message_recipients 
WHERE message_id NOT IN (SELECT id FROM internal_messages);

-- Add comment for documentation
COMMENT ON TABLE internal_message_recipients IS 'Links internal messages to recipients. Cleaned up orphaned records on 2025-11-20.';
