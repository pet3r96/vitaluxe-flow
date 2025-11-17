/**
 * Messages Domain Types
 * Centralized type definitions for messaging and communication systems
 */

import type { Database } from "@/integrations/supabase/types";

type ThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];

// ============= Message Threads =============

export type ThreadType = 'patient_support' | 'internal_team' | 'order_related' | 'general';
export type SenderType = 'patient' | 'practice' | 'system';

export interface MessageThread {
  id: string;
  subject: string;
  thread_type: ThreadType;
  created_by: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadCreator {
  id: string;
  name: string;
  email?: string;
}

export interface ThreadOrder {
  id: string;
  created_at: string;
  total_amount?: number;
  status?: string;
}

export interface ThreadParticipant {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface ThreadWithRelations extends ThreadRow {
  creator?: ThreadCreator;
  orders?: ThreadOrder;
  participants?: ThreadParticipant[];
  resolver?: ThreadCreator;
  disposition_type?: string;
  disposition_notes?: string;
}

export interface ThreadWithParticipants extends MessageThread {
  participants: ThreadParticipant[];
  unread_count?: number;
  latest_message?: Message;
}

// ============= Messages =============

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  message_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface MessageWithSender extends Message {
  sender_profile?: {
    id: string;
    name: string;
    email?: string;
  };
}

// ============= Patient Messages (Legacy) =============

export interface PatientMessage {
  id: string;
  patient_id: string;
  practice_id: string;
  subject: string;
  body: string;
  sender_type: SenderType;
  read_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  parent_message_id: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    first_name: string;
    last_name: string;
  };
}

// ============= Internal Messages =============

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
export type InternalMessageType = 'task' | 'note' | 'alert' | 'general';

export interface InternalMessage {
  id: string;
  practice_id: string;
  created_by: string;
  subject: string;
  body: string;
  message_type: InternalMessageType;
  priority: MessagePriority;
  patient_id?: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InternalMessageRecipient {
  id: string;
  message_id: string;
  recipient_id: string;
  read_at: string | null;
  created_at: string;
}

export interface InternalMessageWithRecipients extends InternalMessage {
  created_by_profile?: {
    id: string;
    name: string;
    email?: string;
  };
  recipients?: Array<{
    id: string;
    name: string;
    email?: string;
    read_at: string | null;
  }>;
}

// ============= Read Status =============

export interface MessageThreadReadStatus {
  id: string;
  thread_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
}

// ============= Disposition Types =============

export type DispositionType = 
  | "refund_issued"
  | "replacement_sent"
  | "customer_satisfied"
  | "escalated"
  | "no_action_needed"
  | string;
