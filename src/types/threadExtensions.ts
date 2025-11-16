import type { Database } from "@/integrations/supabase/types";

type ThreadRow = Database["public"]["Tables"]["message_threads"]["Row"];

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
}

export interface ThreadWithRelations extends ThreadRow {
  creator?: ThreadCreator;
  orders?: ThreadOrder;
  participants?: ThreadParticipant[];
  resolver?: ThreadCreator;
  disposition_type?: string;
  disposition_notes?: string;
}
