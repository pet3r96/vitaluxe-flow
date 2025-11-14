-- Performance Optimization Indexes
-- These indexes dramatically improve query performance for high-traffic pages

-- Orders table indexes for faster filtering and sorting
CREATE INDEX IF NOT EXISTS idx_orders_doctor_created 
  ON orders(doctor_id, created_at DESC) 
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC);

-- Appointments table indexes for calendar and waiting room
CREATE INDEX IF NOT EXISTS idx_appointments_practice_time 
  ON patient_appointments(practice_id, start_time, status);

CREATE INDEX IF NOT EXISTS idx_appointments_provider_time
  ON patient_appointments(provider_id, start_time, status);

CREATE INDEX IF NOT EXISTS idx_appointments_waiting_room
  ON patient_appointments(practice_id, status, checked_in_at)
  WHERE status = 'checked_in';

-- Order lines table indexes for faster joins
CREATE INDEX IF NOT EXISTS idx_order_lines_order_status
  ON order_lines(order_id, status);

-- Follow-ups table index for dashboard widget
CREATE INDEX IF NOT EXISTS idx_follow_ups_pending_date
  ON patient_follow_ups(status, follow_up_date)
  WHERE status = 'pending';

-- Internal messages for unread counts
CREATE INDEX IF NOT EXISTS idx_internal_messages_recipient_unread
  ON internal_message_recipients(recipient_id, read_at)
  WHERE read_at IS NULL;