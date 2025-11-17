/**
 * Video session and event types
 */

export type VideoSessionStatus = 'scheduled' | 'waiting' | 'live' | 'completed' | 'cancelled';

export interface VideoEventData {
  event_type: string;
  user_uid?: string;
  message?: string;
  sender_name?: string;
  timestamp?: string;
  [key: string]: any; // For extensibility
}

export interface MergedSessionEvent {
  id: string;
  appointment_id?: string;
  patient_id: string;
  provider_id: string;
  scheduled_start_time: string;
  status: VideoSessionStatus;
  patient_accounts: any;
}

export interface EdgeFunctionError {
  message?: string;
  error?: string;
}
