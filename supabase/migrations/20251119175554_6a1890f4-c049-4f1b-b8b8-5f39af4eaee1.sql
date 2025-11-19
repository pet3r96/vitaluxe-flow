-- ============================================
-- PHASE 1: FIX DATABASE CONSTRAINTS
-- ============================================

-- 1.1: Add UNIQUE constraint to pharmacy_shipping_rates for upsert operations
ALTER TABLE pharmacy_shipping_rates 
  DROP CONSTRAINT IF EXISTS pharmacy_shipping_rates_pharmacy_speed_unique;

ALTER TABLE pharmacy_shipping_rates 
  ADD CONSTRAINT pharmacy_shipping_rates_pharmacy_speed_unique 
  UNIQUE (pharmacy_id, shipping_speed);

-- 1.2: Fix internal_messages message_type constraint to include 'announcement'
ALTER TABLE internal_messages 
  DROP CONSTRAINT IF EXISTS internal_messages_message_type_check;

ALTER TABLE internal_messages 
  ADD CONSTRAINT internal_messages_message_type_check 
  CHECK (message_type IN ('general', 'task', 'alert', 'note', 'announcement'));

-- 1.3: Verify and update RLS policies on support_tickets
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Practices can view their own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON support_tickets;

-- Admins can view all support tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Practices can view tickets they created
CREATE POLICY "Practices can view their own tickets"
  ON support_tickets FOR SELECT
  USING (
    created_by = auth.uid() OR
    practice_id = auth.uid() OR
    practice_id IN (
      SELECT practice_id 
      FROM providers 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can update their own tickets
CREATE POLICY "Users can update their own tickets"
  ON support_tickets FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_practice_id ON support_tickets(practice_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);