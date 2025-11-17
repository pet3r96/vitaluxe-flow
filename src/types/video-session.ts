/**
 * Video Session Type Definitions
 */

export type VideoSessionStatus = 'scheduled' | 'waiting' | 'active' | 'completed' | 'cancelled' | 'no_show';

export interface VideoSession {
  id: string;
  appointment_id?: string;
  patient_id: string;
  provider_id: string;
  practice_id: string;
  scheduled_start_time: string;
  actual_start_time?: string;
  end_time?: string;
  status: VideoSessionStatus;
  agora_channel_name?: string;
  agora_token?: string;
  guest_token?: string;
  guest_link_expires_at?: string;
  recording_enabled?: boolean;
  recording_consent_given?: boolean;
  recording_url?: string;
  session_notes?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface VideoSessionWithRelations extends VideoSession {
  patient_accounts?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
  providers?: {
    id: string;
    name?: string;
    email?: string;
  };
}
