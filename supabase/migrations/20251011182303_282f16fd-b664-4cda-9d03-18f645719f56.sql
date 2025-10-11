-- Add new columns to message_threads for order-linked tickets with disposition tracking
ALTER TABLE message_threads 
ADD COLUMN thread_type text DEFAULT 'support' CHECK (thread_type IN ('support', 'order_issue')),
ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
ADD COLUMN disposition_type text,
ADD COLUMN disposition_notes text;

-- Create indexes for better query performance
CREATE INDEX idx_message_threads_order_id ON message_threads(order_id);
CREATE INDEX idx_message_threads_thread_type ON message_threads(thread_type);