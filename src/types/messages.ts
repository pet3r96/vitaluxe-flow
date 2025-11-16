import type { Database } from "@/integrations/supabase/types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type InternalMessageRow = Database["public"]["Tables"]["internal_messages"]["Row"];

// Re-export thread types for convenience
export type { ThreadWithRelations, ThreadCreator, ThreadOrder, ThreadParticipant } from "./threadExtensions";

export type DispositionType = 
  | "refund_issued"
  | "replacement_sent"
  | "customer_satisfied"
  | "escalated"
  | "no_action_needed"
  | string;

export interface MessageRecord extends MessageRow {
  profiles?: {
    name: string;
    email?: string;
  };
  sender_profile?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface InternalMessageRecord extends InternalMessageRow {
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

export interface PatientMessageThread {
  id: string;
  subject: string;
  body?: string;
  created_at: string;
  updated_at: string;
  resolved: boolean;
  resolved_at: string | null;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  latest_message?: {
    body: string;
    created_at: string;
    sender_type: string;
  };
}
