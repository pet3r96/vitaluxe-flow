-- Enable realtime for cart_lines table
ALTER PUBLICATION supabase_realtime ADD TABLE cart_lines;

-- Add index for better realtime performance on cart_id
CREATE INDEX IF NOT EXISTS idx_cart_lines_cart_id_expires_at 
ON cart_lines(cart_id, expires_at);