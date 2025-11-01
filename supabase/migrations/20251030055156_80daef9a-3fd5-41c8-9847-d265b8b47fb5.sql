-- Fix existing NULL thread_ids for root messages
UPDATE patient_messages 
SET thread_id = id 
WHERE parent_message_id IS NULL AND thread_id IS NULL;

-- Fix existing NULL thread_ids for replies using recursive CTE
WITH RECURSIVE thread_tree AS (
  -- Base case: root messages (already have thread_id set above)
  SELECT id, id as root_id, parent_message_id
  FROM patient_messages
  WHERE parent_message_id IS NULL
  
  UNION ALL
  
  -- Recursive case: replies inherit root_id from their parent
  SELECT pm.id, tt.root_id, pm.parent_message_id
  FROM patient_messages pm
  INNER JOIN thread_tree tt ON pm.parent_message_id = tt.id
)
UPDATE patient_messages pm
SET thread_id = tt.root_id
FROM thread_tree tt
WHERE pm.id = tt.id AND pm.thread_id IS NULL;