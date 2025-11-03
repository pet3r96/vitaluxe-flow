-- Create ENUM types for support tickets
CREATE TYPE ticket_type AS ENUM (
  'pharmacy_order_issue',
  'practice_to_admin',
  'rep_to_admin',
  'pharmacy_to_admin',
  'pharmacy_to_practice'
);

CREATE TYPE ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting_response',
  'resolved',
  'closed'
);

CREATE TYPE ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  ticket_type ticket_type NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  
  -- Subject and description
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Who created this ticket
  created_by UUID NOT NULL,
  created_by_role TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,
  
  -- Related entities (nullable based on ticket type)
  practice_id UUID,
  pharmacy_id UUID,
  order_id UUID,
  order_line_id UUID,
  patient_id UUID,
  
  -- Assignment
  assigned_to UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_reply_at TIMESTAMP WITH TIME ZONE
);

-- Create support_ticket_replies table
CREATE TABLE public.support_ticket_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  
  -- Who replied
  replied_by UUID NOT NULL,
  replied_by_role TEXT NOT NULL,
  replied_by_email TEXT NOT NULL,
  replied_by_name TEXT,
  
  -- Reply content
  message TEXT NOT NULL,
  
  -- Internal note (only visible to admins/internal team)
  is_internal_note BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_support_tickets_created_by ON public.support_tickets(created_by);
CREATE INDEX idx_support_tickets_practice_id ON public.support_tickets(practice_id);
CREATE INDEX idx_support_tickets_pharmacy_id ON public.support_tickets(pharmacy_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_ticket_type ON public.support_tickets(ticket_type);
CREATE INDEX idx_support_ticket_replies_ticket_id ON public.support_ticket_replies(ticket_id);

-- Create sequence for ticket numbers
CREATE SEQUENCE ticket_number_seq START 1000;

-- Function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TKT-' || LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Trigger to update updated_at and last_reply_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.support_tickets
  SET updated_at = NOW(), last_reply_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ticket_on_reply
  AFTER INSERT ON public.support_ticket_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets

-- Admins can see all tickets
CREATE POLICY "Admins can view all support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all support tickets"
  ON public.support_tickets
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Practices can see their own tickets and related tickets
CREATE POLICY "Practices can view their support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    (created_by = auth.uid()) OR
    (practice_id = auth.uid()) OR
    (practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())) OR
    (ticket_type = 'pharmacy_to_practice' AND practice_id = auth.uid())
  );

CREATE POLICY "Practices can create support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (created_by_role = 'doctor' OR created_by_role = 'staff')
  );

CREATE POLICY "Practices can update their own tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    practice_id = auth.uid() OR
    (practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid()))
  );

-- Reps (topline/downline) can only see their own tickets to admin
CREATE POLICY "Reps can view their own support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    created_by = auth.uid() AND
    ticket_type = 'rep_to_admin'
  );

CREATE POLICY "Reps can create tickets to admin"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    ticket_type = 'rep_to_admin' AND
    (created_by_role = 'topline' OR created_by_role = 'downline')
  );

CREATE POLICY "Reps can update their own tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (created_by = auth.uid() AND ticket_type = 'rep_to_admin');

-- Pharmacies can see relevant tickets
CREATE POLICY "Pharmacies can view their support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    (ticket_type = 'pharmacy_order_issue' AND pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid()))
  );

CREATE POLICY "Pharmacies can create support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    created_by_role = 'pharmacy'
  );

CREATE POLICY "Pharmacies can update their own tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    (pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid()))
  );

-- RLS Policies for support_ticket_replies

-- Admins can see all replies
CREATE POLICY "Admins can view all ticket replies"
  ON public.support_ticket_replies
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create ticket replies"
  ON public.support_ticket_replies
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can see replies to tickets they have access to
CREATE POLICY "Users can view replies to accessible tickets"
  ON public.support_ticket_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_ticket_replies.ticket_id
      AND (
        st.created_by = auth.uid() OR
        st.practice_id = auth.uid() OR
        (st.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())) OR
        (st.pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())) OR
        has_role(auth.uid(), 'admin'::app_role)
      )
    )
  );

-- Users can reply to tickets they have access to
CREATE POLICY "Users can create replies to accessible tickets"
  ON public.support_ticket_replies
  FOR INSERT
  WITH CHECK (
    replied_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_ticket_replies.ticket_id
      AND (
        st.created_by = auth.uid() OR
        st.practice_id = auth.uid() OR
        (st.practice_id IN (SELECT practice_id FROM providers WHERE user_id = auth.uid())) OR
        (st.pharmacy_id IN (SELECT id FROM pharmacies WHERE user_id = auth.uid())) OR
        has_role(auth.uid(), 'admin'::app_role)
      )
    )
  );