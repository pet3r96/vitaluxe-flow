-- Create password status tracking table
CREATE TABLE user_password_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  must_change_password BOOLEAN DEFAULT true,
  temporary_password_sent BOOLEAN DEFAULT false,
  first_login_completed BOOLEAN DEFAULT false,
  password_last_changed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_password_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own password status"
  ON user_password_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own password status"
  ON user_password_status FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all password statuses"
  ON user_password_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert password statuses"
  ON user_password_status FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_user_password_status_updated_at
  BEFORE UPDATE ON user_password_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();