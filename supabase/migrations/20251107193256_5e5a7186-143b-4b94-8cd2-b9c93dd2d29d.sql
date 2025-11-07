-- Delete any existing SMS templates first to avoid duplicates
DELETE FROM notification_templates 
WHERE channel = 'sms' AND practice_id IS NULL;

-- Add comprehensive SMS templates for all notification types
-- All templates are under 160 characters and include "Reply STOP to opt out"

INSERT INTO notification_templates (event_type, channel, message_template, is_default, active, created_at, updated_at)
VALUES
  -- Appointment notifications
  ('appointment_confirmed', 'sms', '{{provider_name}}: Appt confirmed for {{appointment_date}} at {{appointment_time}}. Log in to view. Reply STOP to opt out.', true, true, now(), now()),
  ('appointment_cancelled', 'sms', '{{provider_name}}: Your {{appointment_date}} appt has been cancelled. Log in for details. Reply STOP to opt out.', true, true, now(), now()),
  ('appointment_rescheduled', 'sms', '{{provider_name}}: Appt rescheduled to {{appointment_date}} {{appointment_time}}. Log in to confirm. Reply STOP to opt out.', true, true, now(), now()),
  ('appointment_reminder', 'sms', 'Reminder: Appt with {{provider_name}} on {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out.', true, true, now(), now()),
  ('appointment_completed', 'sms', '{{provider_name}}: Thank you for your visit! View summary at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('appointment_no_show', 'sms', '{{provider_name}}: We missed you at your {{appointment_date}} appt. Please reschedule. Reply STOP to opt out.', true, true, now(), now()),
  
  -- Message notifications
  ('message_received', 'sms', 'New message from {{from_name}}. Log in to app.vitaluxeservices.com to view. Reply STOP to opt out.', true, true, now(), now()),
  ('message_reply_received', 'sms', '{{from_name}} replied to your message. Log in to view at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  
  -- Order notifications
  ('order_confirmed', 'sms', 'Order #{{order_number}} confirmed. Total: ${{order_total}}. Track at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('order_shipped', 'sms', 'Order #{{order_number}} shipped! Track: {{tracking_number}}. View at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('order_delivered', 'sms', 'Order #{{order_number}} delivered. Thank you for your order! Reply STOP to opt out.', true, true, now(), now()),
  ('order_cancelled', 'sms', 'Order #{{order_number}} cancelled. Refund processing. View at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('order_refund_approved', 'sms', 'Refund approved for order #{{order_number}}. Amount: ${{refund_amount}}. Reply STOP to opt out.', true, true, now(), now()),
  
  -- Prescription notifications
  ('prescription_ready', 'sms', '{{pharmacy_name}}: Prescription ready for pickup. View details at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('prescription_approved', 'sms', '{{provider_name}}: Prescription approved and sent to pharmacy. Reply STOP to opt out.', true, true, now(), now()),
  ('prescription_denied', 'sms', '{{provider_name}}: Prescription requires review. Log in for details. Reply STOP to opt out.', true, true, now(), now()),
  
  -- Form notifications  
  ('form_submitted', 'sms', 'Form "{{form_name}}" submitted successfully. View at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  ('form_response_received', 'sms', 'Response received for "{{form_name}}". Log in to view at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now()),
  
  -- System notifications
  ('system_alert', 'sms', 'Vitaluxe Alert: {{alert_message}}. Log in for more info. Reply STOP to opt out.', true, true, now(), now()),
  ('password_reset', 'sms', 'Password reset requested. Use code: {{reset_code}}. Expires in 15 min. Reply STOP to opt out.', true, true, now(), now()),
  ('account_locked', 'sms', 'Your account has been locked for security. Contact support or log in to unlock. Reply STOP to opt out.', true, true, now(), now()),
  ('payment_failed', 'sms', 'Payment declined for order #{{order_number}}. Update payment at app.vitaluxeservices.com. Reply STOP to opt out.', true, true, now(), now());