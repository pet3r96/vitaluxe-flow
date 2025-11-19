-- Phase 1: Recreate practice_blocked_time table
CREATE TABLE IF NOT EXISTS public.practice_blocked_time (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_by UUID NOT NULL REFERENCES profiles(id),
  block_type TEXT NOT NULL CHECK (block_type IN ('practice_closure', 'provider_unavailable')),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT provider_required_for_unavailable CHECK (
    (block_type = 'provider_unavailable' AND provider_id IS NOT NULL) OR
    (block_type = 'practice_closure' AND provider_id IS NULL)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_blocked_time_practice_id ON public.practice_blocked_time(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_blocked_time_provider_id ON public.practice_blocked_time(provider_id);
CREATE INDEX IF NOT EXISTS idx_practice_blocked_time_time_range ON public.practice_blocked_time(start_time, end_time);

-- Enable RLS
ALTER TABLE public.practice_blocked_time ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage all blocked time
CREATE POLICY "Admins can manage all blocked time"
  ON public.practice_blocked_time
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policy: Practice owners and staff can manage their practice's blocked time
CREATE POLICY "Practices can manage their blocked time"
  ON public.practice_blocked_time
  FOR ALL
  USING (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- RLS Policy: Providers can manage only their own unavailability
CREATE POLICY "Providers can manage their unavailability"
  ON public.practice_blocked_time
  FOR ALL
  USING (
    block_type = 'provider_unavailable' AND
    provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    block_type = 'provider_unavailable' AND
    provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_practice_blocked_time_updated_at
  BEFORE UPDATE ON public.practice_blocked_time
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.practice_blocked_time;

-- Phase 2: Fix practice_rooms RLS Policy
DROP POLICY IF EXISTS "Practices can manage their rooms" ON public.practice_rooms;

CREATE POLICY "Practices can manage their rooms"
  ON public.practice_rooms
  FOR ALL
  USING (
    practice_id = auth.uid() OR 
    practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id 
      FROM practice_staff 
      WHERE user_id = auth.uid() AND active = true
    )
  );