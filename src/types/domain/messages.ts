export interface PatientMessage {
  id: string;
  patient_id: string;
  practice_id: string;
  subject: string;
  body: string;
  sender_type: 'patient' | 'practice';
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
