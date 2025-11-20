-- Add missing notification_type enum value for message_received
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'message_received';