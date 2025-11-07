-- Add admin-specific notification types to enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_signup';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'system_error';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'support_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'security_alert';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_action_required';