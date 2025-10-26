-- Fix pending_product_requests INSERT policy to support admin impersonation

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Pharmacies can insert product requests" ON pending_product_requests;

-- Create new policy that supports both direct pharmacy users and admin impersonation
CREATE POLICY "Pharmacies can insert product requests"
  ON pending_product_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Direct pharmacy user inserting their own request
    (
      auth.uid() = created_by_user_id 
      AND has_role(auth.uid(), 'pharmacy')
      AND pharmacy_id IN (
        SELECT id FROM pharmacies WHERE user_id = auth.uid()
      )
    )
    OR
    -- Admin impersonating a pharmacy user
    (
      has_role(auth.uid(), 'admin')
      AND EXISTS (
        SELECT 1 
        FROM active_impersonation_sessions ais
        JOIN pharmacies p ON p.user_id = ais.impersonated_user_id
        WHERE ais.admin_user_id = auth.uid()
          AND ais.expires_at > now()
          AND ais.impersonated_user_id = created_by_user_id
          AND p.id = pending_product_requests.pharmacy_id
      )
    )
  );