-- Step 1: Delete duplicate video_sessions, keeping only the newest one per appointment
DELETE FROM video_sessions
WHERE id IN (
  SELECT id 
  FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY appointment_id 
             ORDER BY created_at DESC
           ) as rn
    FROM video_sessions
    WHERE appointment_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Step 2: Add UNIQUE constraint to prevent future duplicates
ALTER TABLE video_sessions 
ADD CONSTRAINT video_sessions_appointment_id_unique 
UNIQUE (appointment_id);