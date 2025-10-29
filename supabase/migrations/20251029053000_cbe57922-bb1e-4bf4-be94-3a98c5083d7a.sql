-- Create internal_messages table
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Message content
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('general', 'announcement', 'patient_specific')) DEFAULT 'general',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  -- Patient linkage (nullable for general/announcement)
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  
  -- Attachments & records
  attached_document_ids UUID[],
  attached_form_ids UUID[],
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Status tracking
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id)
);

-- Indexes for internal_messages
CREATE INDEX idx_internal_messages_practice ON internal_messages(practice_id);
CREATE INDEX idx_internal_messages_patient ON internal_messages(patient_id);
CREATE INDEX idx_internal_messages_type ON internal_messages(message_type);
CREATE INDEX idx_internal_messages_completed ON internal_messages(completed);
CREATE INDEX idx_internal_messages_created_at ON internal_messages(created_at DESC);

-- Create internal_message_recipients table
CREATE TABLE internal_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, recipient_id)
);

-- Indexes for internal_message_recipients
CREATE INDEX idx_internal_msg_recipients_message ON internal_message_recipients(message_id);
CREATE INDEX idx_internal_msg_recipients_user ON internal_message_recipients(recipient_id);
CREATE INDEX idx_internal_msg_recipients_unread ON internal_message_recipients(recipient_id, read_at) WHERE read_at IS NULL;

-- Create internal_message_replies table
CREATE TABLE internal_message_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for internal_message_replies
CREATE INDEX idx_internal_replies_message ON internal_message_replies(message_id);
CREATE INDEX idx_internal_replies_created_at ON internal_message_replies(created_at);

-- Enable RLS
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_message_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_message_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for internal_messages
CREATE POLICY "Practice members can view internal messages"
  ON internal_messages FOR SELECT
  USING (
    practice_id = auth.uid()
    OR practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
    OR practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Practice members can create internal messages"
  ON internal_messages FOR INSERT
  WITH CHECK (
    practice_id = auth.uid()
    OR practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
    OR practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Practice members can update internal messages"
  ON internal_messages FOR UPDATE
  USING (
    practice_id = auth.uid()
    OR practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
    OR practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Practice members can delete their messages"
  ON internal_messages FOR DELETE
  USING (
    created_by = auth.uid()
    AND (
      practice_id = auth.uid()
      OR practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
      OR practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for internal_message_recipients
CREATE POLICY "Users can view their recipient status"
  ON internal_message_recipients FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Practice members can add recipients"
  ON internal_message_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM internal_messages im
      WHERE im.id = message_id
      AND (
        im.practice_id = auth.uid()
        OR im.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
        OR im.practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can mark messages as read"
  ON internal_message_recipients FOR UPDATE
  USING (recipient_id = auth.uid());

-- RLS Policies for internal_message_replies
CREATE POLICY "Recipients can view replies"
  ON internal_message_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_message_recipients imr
      WHERE imr.message_id = internal_message_replies.message_id
      AND imr.recipient_id = auth.uid()
    )
  );

CREATE POLICY "Practice members can reply"
  ON internal_message_replies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM internal_messages im
      WHERE im.id = message_id
      AND (
        im.practice_id = auth.uid()
        OR im.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())
        OR im.practice_id IN (SELECT practice_id FROM practice_staff WHERE user_id = auth.uid())
      )
    )
  );

-- Function to get practice team members
CREATE OR REPLACE FUNCTION get_practice_team_members(p_practice_id UUID)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  role_type TEXT,
  role_display TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    p.id as user_id,
    p.name,
    'admin'::TEXT as role_type,
    'Practice Owner'::TEXT as role_display
  FROM profiles p
  WHERE p.id = p_practice_id
  
  UNION ALL
  
  SELECT 
    pr.id as user_id,
    pr.name,
    'provider'::TEXT as role_type,
    'Provider'::TEXT as role_display
  FROM profiles pr
  JOIN providers prov ON pr.id = prov.user_id
  WHERE prov.practice_id = p_practice_id
    AND prov.active = true
  
  UNION ALL
  
  SELECT 
    p.id as user_id,
    p.name,
    'staff'::TEXT as role_type,
    COALESCE('Staff - ' || ps.role_type, 'Staff')::TEXT as role_display
  FROM profiles p
  JOIN practice_staff ps ON p.id = ps.user_id
  WHERE ps.practice_id = p_practice_id
    AND ps.active = true
  
  ORDER BY role_type, name;
$$;

-- Notification trigger for new messages
CREATE OR REPLACE FUNCTION notify_internal_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  patient_name TEXT;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.created_by;
  
  IF NEW.patient_id IS NOT NULL THEN
    SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
  END IF;
  
  FOR recipient IN 
    SELECT recipient_id 
    FROM internal_message_recipients 
    WHERE message_id = NEW.id
  LOOP
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url,
      metadata
    ) VALUES (
      recipient.recipient_id,
      CASE 
        WHEN NEW.priority = 'urgent' THEN 'info'
        ELSE 'info'
      END::notification_type,
      CASE 
        WHEN NEW.priority = 'urgent' THEN 'error'
        WHEN NEW.priority = 'high' THEN 'warning'
        ELSE 'info'
      END,
      'clinical',
      CASE 
        WHEN NEW.message_type = 'patient_specific' THEN 'Patient Message: ' || COALESCE(patient_name, 'Unknown')
        WHEN NEW.message_type = 'announcement' THEN 'Announcement: ' || NEW.subject
        ELSE 'Internal Message: ' || NEW.subject
      END,
      sender_name || ' sent a message',
      'internal_message',
      NEW.id::TEXT,
      '/internal-chat?message=' || NEW.id,
      jsonb_build_object(
        'priority', NEW.priority,
        'message_type', NEW.message_type,
        'patient_id', NEW.patient_id
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_internal_message
AFTER INSERT ON internal_messages
FOR EACH ROW EXECUTE FUNCTION notify_internal_message();

-- Notification trigger for replies
CREATE OR REPLACE FUNCTION notify_internal_message_reply()
RETURNS TRIGGER AS $$
DECLARE
  recipient RECORD;
  sender_name TEXT;
  msg_subject TEXT;
BEGIN
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
  SELECT subject INTO msg_subject FROM internal_messages WHERE id = NEW.message_id;
  
  FOR recipient IN 
    SELECT DISTINCT recipient_id 
    FROM internal_message_recipients 
    WHERE message_id = NEW.message_id
    AND recipient_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (
      user_id,
      notification_type,
      severity,
      category,
      title,
      message,
      entity_type,
      entity_id,
      action_url
    ) VALUES (
      recipient.recipient_id,
      'info'::notification_type,
      'info',
      'clinical',
      'New Reply: ' || msg_subject,
      sender_name || ' replied',
      'internal_message',
      NEW.message_id::TEXT,
      '/internal-chat?message=' || NEW.message_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_internal_message_reply
AFTER INSERT ON internal_message_replies
FOR EACH ROW EXECUTE FUNCTION notify_internal_message_reply();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE internal_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_message_recipients;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_message_replies;