/**
 * Message Domain Types
 * Type definitions for patient messages matching current database schema
 */

export interface PatientMessage {
  id: string;
  patient_id: string;
  practice_id: string;
  subject: string;
  body: string; // Updated from message_body
  sender_type: string;
  read_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  parent_message_id: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface InternalMessage {
  id: string;
  practice_id: string;
  created_by: string;
  subject: string;
  body: string;
  message_type: string;
  priority: string;
  completed: boolean;
  completed_at: string | null;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_id: string;
  read_at: string | null;
  created_at: string;
}
