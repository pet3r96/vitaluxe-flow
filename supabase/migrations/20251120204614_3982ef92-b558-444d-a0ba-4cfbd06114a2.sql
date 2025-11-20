-- Add RLS policies for notification_queue to allow service role operations
-- This is critical for database triggers and the queue processor to function

-- Enable RLS on notification_queue (if not already enabled)
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow service role to INSERT (for database triggers)
CREATE POLICY "service_role_insert_notification_queue"
ON notification_queue
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy 2: Allow service role to SELECT (for queue processor to read pending items)
CREATE POLICY "service_role_select_notification_queue"
ON notification_queue
FOR SELECT
TO service_role
USING (true);

-- Policy 3: Allow service role to UPDATE (for queue processor to mark as sent/failed)
CREATE POLICY "service_role_update_notification_queue"
ON notification_queue
FOR UPDATE
TO service_role
USING (true);

-- Policy 4: Allow authenticated users to view their own notifications in queue
CREATE POLICY "users_view_own_notification_queue"
ON notification_queue
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add comment explaining the policies
COMMENT ON TABLE notification_queue IS 'Queue for processing notifications asynchronously. Service role has full access for triggers and processor. Users can view their own queued notifications.';