-- Drop existing UPDATE policy for cart_lines that blocks impersonation
DROP POLICY IF EXISTS "Users can update their own cart lines" ON cart_lines;

-- Create new UPDATE policy that supports impersonation
CREATE POLICY "Users can update their own cart lines" ON cart_lines
FOR UPDATE
USING (
  -- Direct ownership: user owns the cart
  is_cart_owner(auth.uid(), cart_id)
  OR
  -- Admin impersonation: admin has active session and cart belongs to impersonated user
  EXISTS (
    SELECT 1 FROM active_impersonation_sessions ais
    JOIN cart c ON c.doctor_id = ais.impersonated_user_id
    WHERE ais.admin_user_id = auth.uid()
      AND ais.expires_at > now()
      AND c.id = cart_lines.cart_id
  )
);