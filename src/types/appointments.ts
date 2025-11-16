import { Database } from "@/integrations/supabase/types";

export type AppointmentRow = Database['public']['Tables']['patient_appointments']['Row'];

export interface PatientAccountBasic {
  id: string;
  first_name: string;
  last_name: string;
}

export interface AppointmentWithRelations extends AppointmentRow {
  patient_account?: PatientAccountBasic;
}

export interface AppointmentServiceType {
  id: string;
  name: string;
  description?: string | null;
  typical_duration_minutes: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
