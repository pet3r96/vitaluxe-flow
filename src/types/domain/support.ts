/**
 * Support & Ticket Domain Types
 */

import type { Database } from '@/integrations/supabase/types';

export type SupportTicket = Database['public']['Tables']['support_tickets']['Row'];
export type SupportTicketReply = Database['public']['Tables']['support_ticket_replies']['Row'];

/**
 * Support ticket with joined relations
 */
export interface SupportTicketWithRelations extends SupportTicket {
  support_ticket_replies: { id: string }[];
}

/**
 * Patient message structure
 */
export interface PatientMessage {
  id: string;
  subject: string | null;
  message_body: string | null;
  created_at: string;
  resolved: boolean | null;
  thread_id: string | null;
  patient_id: string | null;
}

/**
 * Support ticket tab state
 */
export type TicketTabState = 'all' | 'open' | 'resolved';

/**
 * Support ticket RPC result from get_support_tickets
 */
export interface SupportTicketRPCResult {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  ticket_type: string;
  created_by_email: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  resolved: boolean;
  reply_count?: number;
}
