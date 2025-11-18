-- Add missing notification_type ENUM values that are actively used in the codebase
-- This fixes database constraint violations when inserting notifications

-- Add all missing notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_placed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'order_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'appointment_booked';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'appointment_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'appointment_update';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_activated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_suspended';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_renewed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'subscription_alert';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'document_uploaded_by_patient';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'patient_message_received';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_patient_message';