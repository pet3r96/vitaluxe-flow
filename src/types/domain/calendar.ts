/**
 * Calendar Domain Types
 * Type definitions for appointment scheduling, providers, rooms, and calendar views
 */

import type { Database } from '@/integrations/supabase/types';

// Base appointment type from database
type DbAppointment = Database['public']['Tables']['patient_appointments']['Row'];

// Provider information
export interface CalendarProvider {
  id: string;
  first_name?: string;
  last_name?: string;
  specialty?: string;
  email?: string;
  phone?: string;
  role?: string;
  linked_practice_id?: string | null;
  type?: string;
  avatar_url?: string;
  user?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    [key: string]: unknown;
  };
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    prescriber_name?: string;
    full_name?: string;
  };
}

// Room/location information
export interface CalendarRoom {
  id: string;
  name: string;
  practice_id: string;
  capacity?: number;
  is_active?: boolean;
}

// Patient information within appointments
export interface CalendarPatient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
}

// Extended appointment with relations
export interface CalendarAppointment extends DbAppointment {
  patient_accounts?: CalendarPatient;
  patient?: CalendarPatient;
  provider?: CalendarProvider;
  room?: CalendarRoom;
  // Layout properties for rendering overlapping appointments
  columnIndex?: number;
  columnWidth?: number;
  columnLeft?: number;
  maxConcurrent?: number;
}

// Blocked time slots
export interface BlockedTimeSlot {
  id: string;
  practice_id: string;
  provider_id?: string;
  room_id?: string;
  start_time: string;
  end_time: string;
  reason?: string;
  recurrence_rule?: string;
  block_type?: string;
  created_at?: string;
}

// Video session information
export interface VideoSession {
  id: string;
  practice_id: string;
  appointment_id: string;
  session_id?: string; // Optional for synthetic sessions
  channel_name: string;
  agora_token?: string;
  status: string; // Relaxed from literal union to support various statuses
  scheduled_start_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
  patient_joined_at?: string;
  provider_joined_at?: string;
  created_at: string;
  updated_at: string;
  isSynthetic?: boolean;
  patient_appointments?: Partial<CalendarAppointment> & {
    patient?: CalendarPatient;
    provider_id?: string;
  };
}

// Search result type
export interface AppointmentSearchResult extends CalendarAppointment {
  searchScore?: number;
  matchedFields?: string[];
}

// Filter options
export interface CalendarFilters {
  selectedProviders: string[];
  selectedRooms: string[];
  selectedStatuses: string[];
}

// Time slot for calendar grid
export interface TimeSlot {
  hour: number;
  minute: number;
  date: Date;
}

// Appointment with layout calculations for overlap detection
export interface AppointmentWithLayout extends CalendarAppointment {
  columnIndex: number;
  columnWidth: number;
  columnLeft: number;
  maxConcurrent: number;
}

// Calendar view configuration
export interface CalendarViewConfig {
  startHour: number;
  endHour: number;
  slotDuration: number; // in minutes
  showWeekends: boolean;
}

// Appointment status configuration
export interface AppointmentStatusConfig {
  value: string;
  label: string;
  color: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}
