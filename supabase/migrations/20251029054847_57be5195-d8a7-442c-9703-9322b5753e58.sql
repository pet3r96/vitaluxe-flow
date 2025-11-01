-- Create security definer function to check practice message access
CREATE OR REPLACE FUNCTION public.can_access_practice_messages(_actor uuid, _practice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct practice owner
  IF _practice_id = _actor THEN
    RETURN true;
  END IF;

  -- Provider of the practice
  IF EXISTS (
    SELECT 1 FROM providers
    WHERE user_id = _actor AND practice_id = _practice_id
  ) THEN
    RETURN true;
  END IF;

  -- Staff member of the practice
  IF EXISTS (
    SELECT 1 FROM practice_staff
    WHERE user_id = _actor AND practice_id = _practice_id
  ) THEN
    RETURN true;
  END IF;

  -- Active impersonation session
  IF EXISTS (
    SELECT 1 FROM active_impersonation_sessions ais
    WHERE ais.admin_user_id = _actor
      AND ais.expires_at > now()
      AND (
        -- Impersonating the practice owner
        ais.impersonated_user_id = _practice_id
        OR
        -- Impersonating a provider of the practice
        EXISTS (
          SELECT 1 FROM providers p
          WHERE p.user_id = ais.impersonated_user_id
            AND p.practice_id = _practice_id
        )
        OR
        -- Impersonating a staff member of the practice
        EXISTS (
          SELECT 1 FROM practice_staff ps
          WHERE ps.user_id = ais.impersonated_user_id
            AND ps.practice_id = _practice_id
        )
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Update internal_messages RLS policies
DROP POLICY IF EXISTS "Admins manage all appointment settings" ON internal_messages;
DROP POLICY IF EXISTS "Practice members can create messages" ON internal_messages;
DROP POLICY IF EXISTS "Practice members can view messages" ON internal_messages;
DROP POLICY IF EXISTS "Practice members can update messages" ON internal_messages;
DROP POLICY IF EXISTS "Message creators can delete messages" ON internal_messages;

ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible practice messages"
ON internal_messages FOR SELECT
USING (can_access_practice_messages(auth.uid(), practice_id));

CREATE POLICY "Users can create messages in accessible practices"
ON internal_messages FOR INSERT
WITH CHECK (can_access_practice_messages(auth.uid(), practice_id));

CREATE POLICY "Users can update accessible practice messages"
ON internal_messages FOR UPDATE
USING (can_access_practice_messages(auth.uid(), practice_id))
WITH CHECK (can_access_practice_messages(auth.uid(), practice_id));

CREATE POLICY "Users can delete their own messages or via impersonation"
ON internal_messages FOR DELETE
USING (
  can_access_practice_messages(auth.uid(), practice_id)
  AND (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM active_impersonation_sessions ais
      WHERE ais.admin_user_id = auth.uid()
        AND ais.impersonated_user_id = created_by
        AND ais.expires_at > now()
    )
  )
);

-- Update internal_message_recipients RLS policies
DROP POLICY IF EXISTS "Practice members can add recipients" ON internal_message_recipients;
DROP POLICY IF EXISTS "Users can view their recipient status" ON internal_message_recipients;
DROP POLICY IF EXISTS "Users can mark messages as read" ON internal_message_recipients;

CREATE POLICY "Users can add recipients to accessible messages"
ON internal_message_recipients FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM internal_messages im
    WHERE im.id = message_id
      AND can_access_practice_messages(auth.uid(), im.practice_id)
  )
);

CREATE POLICY "Users can view their recipient status"
ON internal_message_recipients FOR SELECT
USING (recipient_id = auth.uid());

CREATE POLICY "Message creators and practice members can view recipients"
ON internal_message_recipients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM internal_messages im
    WHERE im.id = message_id
      AND (
        im.created_by = auth.uid()
        OR can_access_practice_messages(auth.uid(), im.practice_id)
      )
  )
);

CREATE POLICY "Users can mark messages as read"
ON internal_message_recipients FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Update internal_message_replies RLS policies
DROP POLICY IF EXISTS "Practice members can reply" ON internal_message_replies;
DROP POLICY IF EXISTS "Recipients can view replies" ON internal_message_replies;

CREATE POLICY "Users can reply to accessible messages"
ON internal_message_replies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM internal_messages im
    WHERE im.id = message_id
      AND can_access_practice_messages(auth.uid(), im.practice_id)
  )
);

CREATE POLICY "Users can view replies to accessible messages"
ON internal_message_replies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM internal_messages im
    WHERE im.id = message_id
      AND (
        -- Message creator
        im.created_by = auth.uid()
        OR
        -- Recipient of the message
        EXISTS (
          SELECT 1 FROM internal_message_recipients imr
          WHERE imr.message_id = im.id
            AND imr.recipient_id = auth.uid()
        )
        OR
        -- Has practice access
        can_access_practice_messages(auth.uid(), im.practice_id)
      )
  )
);