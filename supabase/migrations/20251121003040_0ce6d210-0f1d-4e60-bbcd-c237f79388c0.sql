-- Create patient-specific unread message count RPC
-- This function queries the patient_messages table (not thread_participants)
CREATE OR REPLACE FUNCTION public.get_patient_unread_message_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_patient_id UUID;
BEGIN
  -- Get patient account id from user_id
  SELECT id INTO v_patient_id
  FROM patient_accounts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_patient_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count unread messages from practice to patient
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM patient_messages
  WHERE patient_id = v_patient_id
    AND sender_type = 'practice'
    AND read_at IS NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$;