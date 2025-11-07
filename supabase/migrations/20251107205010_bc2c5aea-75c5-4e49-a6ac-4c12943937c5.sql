-- Create video_sessions table
CREATE TABLE video_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES patient_appointments(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  provider_id UUID REFERENCES providers(id),
  
  -- Agora Channel Details
  channel_name TEXT NOT NULL UNIQUE,
  agora_channel_id TEXT,
  
  -- Session Status Tracking
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'waiting', 'active', 'ended', 'failed')),
  
  -- Timing Information
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  actual_start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Participant Tracking
  provider_joined_at TIMESTAMPTZ,
  patient_joined_at TIMESTAMPTZ,
  provider_left_at TIMESTAMPTZ,
  patient_left_at TIMESTAMPTZ,
  
  -- Recording Management
  recording_enabled BOOLEAN DEFAULT true,
  recording_started_at TIMESTAMPTZ,
  recording_stopped_at TIMESTAMPTZ,
  recording_resource_id TEXT,
  recording_sid TEXT,
  recording_url TEXT,
  recording_expires_at TIMESTAMPTZ,
  
  -- Quality & Metadata
  connection_quality JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create video_session_logs table
CREATE TABLE video_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  user_id UUID,
  user_type TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_video_sessions_appointment ON video_sessions(appointment_id);
CREATE INDEX idx_video_sessions_practice ON video_sessions(practice_id);
CREATE INDEX idx_video_sessions_status ON video_sessions(status);
CREATE INDEX idx_video_sessions_recording_expires ON video_sessions(recording_expires_at) WHERE recording_url IS NOT NULL;
CREATE INDEX idx_video_logs_session ON video_session_logs(session_id);
CREATE INDEX idx_video_logs_created ON video_session_logs(created_at);

-- Create trigger function to auto-create video sessions
CREATE OR REPLACE FUNCTION create_video_session_for_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_type = 'video' AND NEW.status IN ('scheduled', 'confirmed') THEN
    INSERT INTO video_sessions (
      appointment_id, practice_id, patient_id, provider_id,
      channel_name, scheduled_start_time, status
    ) VALUES (
      NEW.id, NEW.practice_id, NEW.patient_id, NEW.provider_id,
      'session_' || NEW.id::text, NEW.start_time, 'scheduled'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_video_session_trigger
  AFTER INSERT ON patient_appointments
  FOR EACH ROW EXECUTE FUNCTION create_video_session_for_appointment();

-- Enable RLS
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_session_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_sessions
CREATE POLICY "Admins can manage all video sessions"
  ON video_sessions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Providers can view practice video sessions"
  ON video_sessions FOR SELECT
  USING (
    provider_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM providers WHERE user_id = auth.uid()
    ) OR
    practice_id IN (
      SELECT practice_id FROM practice_staff WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "Patients can view their own video sessions"
  ON video_sessions FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Providers can update practice video sessions"
  ON video_sessions FOR UPDATE
  USING (
    provider_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM providers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    provider_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id FROM providers WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for video_session_logs
CREATE POLICY "Admins can view all video logs"
  ON video_session_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert video logs"
  ON video_session_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view logs for their sessions"
  ON video_session_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM video_sessions vs
      WHERE vs.id = session_id
      AND (
        vs.patient_id = auth.uid() OR
        vs.provider_id = auth.uid() OR
        vs.practice_id IN (
          SELECT practice_id FROM providers WHERE user_id = auth.uid()
        )
      )
    )
  );