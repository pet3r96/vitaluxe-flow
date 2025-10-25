export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          id: string
          ip_address: string | null
          locked_at: string | null
          locked_until: string | null
          lockout_reason: string
          notes: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          locked_at?: string | null
          locked_until?: string | null
          lockout_reason: string
          notes?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          locked_at?: string | null
          locked_until?: string | null
          lockout_reason?: string
          notes?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      active_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          last_activity: string
          session_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_activity?: string
          session_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          last_activity?: string
          session_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_ip_banlist: {
        Row: {
          banned: boolean
          banned_at: string
          banned_by: string | null
          banned_reason: string
          created_at: string
          description: string | null
          id: string
          ip_address: string
          updated_at: string
        }
        Insert: {
          banned?: boolean
          banned_at?: string
          banned_by?: string | null
          banned_reason: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address: string
          updated_at?: string
        }
        Update: {
          banned?: boolean
          banned_at?: string
          banned_by?: string | null
          banned_reason?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_role_audit: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          event_type: string
          id: string
          name: string
          notification_channels: Json | null
          recipients: Json | null
          severity: string
          threshold: number
          time_window_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_type: string
          id?: string
          name: string
          notification_channels?: Json | null
          recipients?: Json | null
          severity?: string
          threshold: number
          time_window_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_type?: string
          id?: string
          name?: string
          notification_channels?: Json | null
          recipients?: Json | null
          severity?: string
          threshold?: number
          time_window_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          details: Json | null
          event_type: string
          id: string
          message: string
          notification_error: string | null
          notification_sent: boolean | null
          rule_id: string | null
          severity: string
          triggered_at: string
        }
        Insert: {
          details?: Json | null
          event_type: string
          id?: string
          message: string
          notification_error?: string | null
          notification_sent?: boolean | null
          rule_id?: string | null
          severity: string
          triggered_at?: string
        }
        Update: {
          details?: Json | null
          event_type?: string
          id?: string
          message?: string
          notification_error?: string | null
          notification_sent?: boolean | null
          rule_id?: string | null
          severity?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      amazon_tracking_api_calls: {
        Row: {
          api_response: Json | null
          called_at: string
          called_by: string | null
          created_at: string
          id: string
          order_line_id: string
          response_status: string
          tracking_number: string
        }
        Insert: {
          api_response?: Json | null
          called_at?: string
          called_by?: string | null
          created_at?: string
          id?: string
          order_line_id: string
          response_status?: string
          tracking_number: string
        }
        Update: {
          api_response?: Json | null
          called_at?: string
          called_by?: string | null
          created_at?: string
          id?: string
          order_line_id?: string
          response_status?: string
          tracking_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "amazon_tracking_api_calls_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits_config: {
        Row: {
          api_name: string
          cost_per_call: number | null
          created_at: string
          id: string
          max_calls_per_day: number
          max_calls_per_hour: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_name: string
          cost_per_call?: number | null
          created_at?: string
          id?: string
          max_calls_per_day?: number
          max_calls_per_hour?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_name?: string
          cost_per_call?: number | null
          created_at?: string
          id?: string
          max_calls_per_day?: number
          max_calls_per_hour?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      audit_logs_archive: {
        Row: {
          action_type: string
          archived_at: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action_type: string
          archived_at?: string
          created_at: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action_type?: string
          archived_at?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      cart: {
        Row: {
          created_at: string | null
          doctor_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          doctor_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          doctor_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_access_log: {
        Row: {
          access_count: number | null
          cart_id: string | null
          id: string
          ip_address: string | null
          last_access_at: string | null
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          access_count?: number | null
          cart_id?: string | null
          id?: string
          ip_address?: string | null
          last_access_at?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          access_count?: number | null
          cart_id?: string | null
          id?: string
          ip_address?: string | null
          last_access_at?: string | null
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_access_log_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_lines: {
        Row: {
          assigned_pharmacy_id: string | null
          cart_id: string
          created_at: string | null
          custom_dosage: string | null
          custom_dosage_encrypted: string | null
          custom_sig: string | null
          custom_sig_encrypted: string | null
          destination_state: string
          expires_at: string | null
          id: string
          order_notes: string | null
          patient_address: string | null
          patient_address_encrypted: string | null
          patient_email: string | null
          patient_email_encrypted: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          patient_phone_encrypted: string | null
          prescription_method: string | null
          prescription_url: string | null
          prescription_url_encrypted: string | null
          price_snapshot: number | null
          product_id: string
          provider_id: string | null
          quantity: number | null
          refills_allowed: boolean | null
          refills_remaining: number | null
          refills_total: number | null
          shipping_speed: Database["public"]["Enums"]["shipping_speed"] | null
        }
        Insert: {
          assigned_pharmacy_id?: string | null
          cart_id: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          destination_state: string
          expires_at?: string | null
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_address_encrypted?: string | null
          patient_email?: string | null
          patient_email_encrypted?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          patient_phone_encrypted?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price_snapshot?: number | null
          product_id: string
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"] | null
        }
        Update: {
          assigned_pharmacy_id?: string | null
          cart_id?: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          destination_state?: string
          expires_at?: string | null
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_address_encrypted?: string | null
          patient_email?: string | null
          patient_email_encrypted?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          patient_phone_encrypted?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price_snapshot?: number | null
          product_id?: string
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_lines_assigned_pharmacy_id_fkey"
            columns: ["assigned_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_attestation: {
        Row: {
          checkbox_text: string
          content: string
          created_at: string
          id: string
          is_active: boolean
          subtitle: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          checkbox_text: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          subtitle?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          checkbox_text?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          subtitle?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          order_line_id: string
          rep_id: string
          tier_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          order_line_id: string
          rep_id: string
          tier_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          order_line_id?: string
          rep_id?: string
          tier_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_code_usage: {
        Row: {
          created_at: string
          discount_code_id: string
          first_used_at: string
          id: string
          last_used_at: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_code_id: string
          first_used_at?: string
          id?: string
          last_used_at?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          discount_code_id?: string
          first_used_at?: string
          id?: string
          last_used_at?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_percentage: number
          id: string
          max_uses: number | null
          max_uses_per_user: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percentage: number
          id?: string
          max_uses?: number | null
          max_uses_per_user?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percentage?: number
          id?: string
          max_uses?: number | null
          max_uses_per_user?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          document_type: string
          file_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          storage_path: string
          uploaded_at: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_type: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path: string
          uploaded_at?: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_type?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          storage_path?: string
          uploaded_at?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      easypost_tracking_events: {
        Row: {
          carrier: string | null
          created_at: string | null
          description: string | null
          easypost_tracker_id: string
          event_time: string
          id: string
          message: string | null
          order_line_id: string
          status: string
          tracking_details: Json | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          description?: string | null
          easypost_tracker_id: string
          event_time: string
          id?: string
          message?: string | null
          order_line_id: string
          status: string
          tracking_details?: Json | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          description?: string | null
          easypost_tracker_id?: string
          event_time?: string
          id?: string
          message?: string | null
          order_line_id?: string
          status?: string
          tracking_details?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "easypost_tracking_events_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      encryption_keys: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          key_name: string
          rotated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key_name: string
          rotated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          key_name?: string
          rotated_at?: string | null
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          attempt_count: number | null
          created_at: string
          email: string
          id: string
          ip_address: string
          last_attempt_at: string
          user_agent: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string
          email: string
          id?: string
          ip_address: string
          last_attempt_at?: string
          user_agent?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: string
          last_attempt_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      file_upload_logs: {
        Row: {
          bucket_name: string
          created_at: string | null
          file_name: string
          file_size: number
          id: string
          ip_address: string | null
          mime_type: string
          storage_path: string
          user_agent: string | null
          user_id: string | null
          validation_errors: Json | null
          validation_status: string
          virus_scan_status: string | null
        }
        Insert: {
          bucket_name: string
          created_at?: string | null
          file_name: string
          file_size: number
          id?: string
          ip_address?: string | null
          mime_type: string
          storage_path: string
          user_agent?: string | null
          user_id?: string | null
          validation_errors?: Json | null
          validation_status: string
          virus_scan_status?: string | null
        }
        Update: {
          bucket_name?: string
          created_at?: string | null
          file_name?: string
          file_size?: number
          id?: string
          ip_address?: string | null
          mime_type?: string
          storage_path?: string
          user_agent?: string | null
          user_id?: string | null
          validation_errors?: Json | null
          validation_status?: string
          virus_scan_status?: string | null
        }
        Relationships: []
      }
      impersonation_logs: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          impersonator_email: string
          impersonator_id: string
          ip_address: string | null
          session_id: string | null
          start_time: string
          target_role: string
          target_user_email: string
          target_user_id: string
          target_user_name: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          impersonator_email: string
          impersonator_id: string
          ip_address?: string | null
          session_id?: string | null
          start_time?: string
          target_role: string
          target_user_email: string
          target_user_id: string
          target_user_name?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          impersonator_email?: string
          impersonator_id?: string
          ip_address?: string | null
          session_id?: string | null
          start_time?: string
          target_role?: string
          target_user_email?: string
          target_user_id?: string
          target_user_name?: string | null
        }
        Relationships: []
      }
      impersonation_permissions: {
        Row: {
          can_impersonate: boolean
          created_at: string
          granted_at: string
          granted_by: string | null
          id: string
          notes: string | null
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          can_impersonate?: boolean
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          can_impersonate?: boolean
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_thread_read_status: {
        Row: {
          created_at: string | null
          id: string
          last_read_at: string | null
          last_read_message_id: string | null
          thread_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          thread_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          thread_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_thread_read_status_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_read_status_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_thread_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string | null
          created_by: string | null
          disposition_notes: string | null
          disposition_type: string | null
          id: string
          order_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          subject: string
          thread_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          disposition_notes?: string | null
          disposition_type?: string | null
          id?: string
          order_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          subject: string
          thread_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          disposition_notes?: string | null
          disposition_type?: string | null
          id?: string
          order_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          subject?: string
          thread_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean | null
          id: string
          order_delivered_alerts: boolean | null
          order_shipped_alerts: boolean | null
          order_status_updates: boolean | null
          sms_notifications: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          order_delivered_alerts?: boolean | null
          order_shipped_alerts?: boolean | null
          order_status_updates?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean | null
          id?: string
          order_delivered_alerts?: boolean | null
          order_shipped_alerts?: boolean | null
          order_status_updates?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read: boolean | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read?: boolean | null
          read_at?: string | null
          severity: string
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read?: boolean | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          assigned_pharmacy_id: string | null
          created_at: string | null
          custom_dosage: string | null
          custom_dosage_encrypted: string | null
          custom_sig: string | null
          custom_sig_encrypted: string | null
          delivered_at: string | null
          destination_state: string | null
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          is_refill: boolean | null
          order_id: string
          order_notes: string | null
          original_order_line_id: string | null
          patient_address: string | null
          patient_address_encrypted: string | null
          patient_email: string | null
          patient_email_encrypted: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          patient_phone_encrypted: string | null
          prescription_method: string | null
          prescription_url: string | null
          prescription_url_encrypted: string | null
          price: number
          price_before_discount: number | null
          processing_at: string | null
          product_id: string
          provider_id: string | null
          quantity: number | null
          refill_number: number | null
          refills_allowed: boolean | null
          refills_remaining: number | null
          refills_total: number | null
          shipped_at: string | null
          shipping_carrier:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
          shipping_cost: number | null
          shipping_speed: Database["public"]["Enums"]["shipping_speed"]
          status: Database["public"]["Enums"]["order_status"] | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_pharmacy_id?: string | null
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          delivered_at?: string | null
          destination_state?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          is_refill?: boolean | null
          order_id: string
          order_notes?: string | null
          original_order_line_id?: string | null
          patient_address?: string | null
          patient_address_encrypted?: string | null
          patient_email?: string | null
          patient_email_encrypted?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          patient_phone_encrypted?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id: string
          provider_id?: string | null
          quantity?: number | null
          refill_number?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
          shipped_at?: string | null
          shipping_carrier?:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
          shipping_cost?: number | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"]
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_pharmacy_id?: string | null
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          delivered_at?: string | null
          destination_state?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          is_refill?: boolean | null
          order_id?: string
          order_notes?: string | null
          original_order_line_id?: string | null
          patient_address?: string | null
          patient_address_encrypted?: string | null
          patient_email?: string | null
          patient_email_encrypted?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          patient_phone_encrypted?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price?: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id?: string
          provider_id?: string | null
          quantity?: number | null
          refill_number?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
          shipped_at?: string | null
          shipping_carrier?:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
          shipping_cost?: number | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"]
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_assigned_pharmacy_id_fkey"
            columns: ["assigned_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_original_order_line_id_fkey"
            columns: ["original_order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_profits: {
        Row: {
          admin_profit: number | null
          admin_profit_before_discount: number | null
          base_price: number
          created_at: string | null
          discount_code: string | null
          discount_percentage: number | null
          downline_id: string | null
          downline_price: number | null
          downline_profit: number | null
          downline_profit_before_discount: number | null
          id: string
          order_id: string
          order_line_id: string
          paid_at: string | null
          payment_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          practice_price: number
          quantity: number
          topline_id: string | null
          topline_price: number | null
          topline_profit: number | null
          topline_profit_before_discount: number | null
        }
        Insert: {
          admin_profit?: number | null
          admin_profit_before_discount?: number | null
          base_price: number
          created_at?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          downline_id?: string | null
          downline_price?: number | null
          downline_profit?: number | null
          downline_profit_before_discount?: number | null
          id?: string
          order_id: string
          order_line_id: string
          paid_at?: string | null
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          practice_price: number
          quantity?: number
          topline_id?: string | null
          topline_price?: number | null
          topline_profit?: number | null
          topline_profit_before_discount?: number | null
        }
        Update: {
          admin_profit?: number | null
          admin_profit_before_discount?: number | null
          base_price?: number
          created_at?: string | null
          discount_code?: string | null
          discount_percentage?: number | null
          downline_id?: string | null
          downline_price?: number | null
          downline_profit?: number | null
          downline_profit_before_discount?: number | null
          id?: string
          order_id?: string
          order_line_id?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          practice_price?: number
          quantity?: number
          topline_id?: string | null
          topline_price?: number | null
          topline_profit?: number | null
          topline_profit_before_discount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_profits_downline_id_fkey"
            columns: ["downline_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "rep_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_topline_id_fkey"
            columns: ["topline_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          authorizenet_response: Json | null
          created_at: string
          id: string
          order_id: string
          original_transaction_id: string
          refund_amount: number
          refund_reason: string | null
          refund_status: string
          refund_transaction_id: string
          refund_type: string
          refunded_by: string | null
          updated_at: string
        }
        Insert: {
          authorizenet_response?: Json | null
          created_at?: string
          id?: string
          order_id: string
          original_transaction_id: string
          refund_amount: number
          refund_reason?: string | null
          refund_status?: string
          refund_transaction_id: string
          refund_type: string
          refunded_by?: string | null
          updated_at?: string
        }
        Update: {
          authorizenet_response?: Json | null
          created_at?: string
          id?: string
          order_id?: string
          original_transaction_id?: string
          refund_amount?: number
          refund_reason?: string | null
          refund_status?: string
          refund_transaction_id?: string
          refund_type?: string
          refunded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_configs: {
        Row: {
          color_class: string
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string
          icon_name: string | null
          id: string
          is_active: boolean | null
          is_system_default: boolean | null
          sort_order: number
          status_key: string
          updated_at: string | null
        }
        Insert: {
          color_class: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_system_default?: boolean | null
          sort_order: number
          status_key: string
          updated_at?: string | null
        }
        Update: {
          color_class?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          is_system_default?: boolean | null
          sort_order?: number
          status_key?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          change_reason: string | null
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          created_at: string | null
          id: string
          is_manual_override: boolean | null
          metadata: Json | null
          new_status: string
          old_status: string
          order_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          changed_by_role: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          id?: string
          is_manual_override?: boolean | null
          metadata?: Json | null
          new_status: string
          old_status: string
          order_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          changed_by_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string | null
          id?: string
          is_manual_override?: boolean | null
          metadata?: Json | null
          new_status?: string
          old_status?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          authorizenet_profile_id: string | null
          authorizenet_transaction_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          discount_amount: number | null
          discount_code: string | null
          discount_percentage: number | null
          doctor_id: string
          formatted_shipping_address: string | null
          id: string
          merchant_fee_amount: number | null
          merchant_fee_percentage: number | null
          payment_method_id: string | null
          payment_method_used: string | null
          payment_status: string | null
          practice_address: string | null
          report_notes: string | null
          ship_to: string | null
          shipping_total: number | null
          shipping_verification_status: string | null
          status: string | null
          status_manual_override: boolean | null
          status_override_reason: string | null
          stripe_payment_id: string | null
          subtotal_before_discount: number | null
          total_amount: number
          total_refunded_amount: number
          updated_at: string | null
        }
        Insert: {
          authorizenet_profile_id?: string | null
          authorizenet_transaction_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_percentage?: number | null
          doctor_id: string
          formatted_shipping_address?: string | null
          id?: string
          merchant_fee_amount?: number | null
          merchant_fee_percentage?: number | null
          payment_method_id?: string | null
          payment_method_used?: string | null
          payment_status?: string | null
          practice_address?: string | null
          report_notes?: string | null
          ship_to?: string | null
          shipping_total?: number | null
          shipping_verification_status?: string | null
          status?: string | null
          status_manual_override?: boolean | null
          status_override_reason?: string | null
          stripe_payment_id?: string | null
          subtotal_before_discount?: number | null
          total_amount: number
          total_refunded_amount?: number
          updated_at?: string | null
        }
        Update: {
          authorizenet_profile_id?: string | null
          authorizenet_transaction_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          discount_percentage?: number | null
          doctor_id?: string
          formatted_shipping_address?: string | null
          id?: string
          merchant_fee_amount?: number | null
          merchant_fee_percentage?: number | null
          payment_method_id?: string | null
          payment_method_used?: string | null
          payment_status?: string | null
          practice_address?: string | null
          report_notes?: string | null
          ship_to?: string | null
          shipping_total?: number | null
          shipping_verification_status?: string | null
          status?: string | null
          status_manual_override?: boolean | null
          status_override_reason?: string | null
          stripe_payment_id?: string | null
          subtotal_before_discount?: number | null
          total_amount?: number
          total_refunded_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "practice_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          address: string | null
          address_city: string | null
          address_formatted: string | null
          address_state: string | null
          address_street: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string | null
          allergies: string | null
          allergies_encrypted: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          notes_encrypted: string | null
          phone: string | null
          practice_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          allergies?: string | null
          allergies_encrypted?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          notes_encrypted?: string | null
          phone?: string | null
          practice_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          allergies?: string | null
          allergies_encrypted?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          notes_encrypted?: string | null
          phone?: string | null
          practice_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_practices: {
        Row: {
          address_city: string
          address_formatted: string | null
          address_state: string
          address_street: string
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string
          admin_notes: string | null
          assigned_rep_user_id: string
          company: string
          contract_file: Json | null
          created_at: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          dea: string | null
          email: string
          id: string
          license_number: string
          npi: string
          phone: string
          practice_name: string
          prescriber_dea: string | null
          prescriber_full_name: string
          prescriber_license: string
          prescriber_name: string
          prescriber_npi: string
          prescriber_phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          address_city: string
          address_formatted?: string | null
          address_state: string
          address_street: string
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip: string
          admin_notes?: string | null
          assigned_rep_user_id: string
          company: string
          contract_file?: Json | null
          created_at?: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          dea?: string | null
          email: string
          id?: string
          license_number: string
          npi: string
          phone: string
          practice_name: string
          prescriber_dea?: string | null
          prescriber_full_name: string
          prescriber_license: string
          prescriber_name: string
          prescriber_npi: string
          prescriber_phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          address_city?: string
          address_formatted?: string | null
          address_state?: string
          address_street?: string
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string
          admin_notes?: string | null
          assigned_rep_user_id?: string
          company?: string
          contract_file?: Json | null
          created_at?: string
          created_by_role?: Database["public"]["Enums"]["app_role"]
          created_by_user_id?: string
          dea?: string | null
          email?: string
          id?: string
          license_number?: string
          npi?: string
          phone?: string
          practice_name?: string
          prescriber_dea?: string | null
          prescriber_full_name?: string
          prescriber_license?: string
          prescriber_name?: string
          prescriber_npi?: string
          prescriber_phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_reps: {
        Row: {
          admin_notes: string | null
          assigned_topline_user_id: string | null
          company: string | null
          created_at: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          email: string
          full_name: string
          id: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_topline_user_id?: string | null
          company?: string | null
          created_at?: string
          created_by_role: Database["public"]["Enums"]["app_role"]
          created_by_user_id: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_topline_user_id?: string | null
          company?: string | null
          created_at?: string
          created_by_role?: Database["public"]["Enums"]["app_role"]
          created_by_user_id?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          active: boolean | null
          address: string | null
          address_city: string | null
          address_formatted: string | null
          address_state: string | null
          address_street: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string | null
          contact_email: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          priority_map: Json | null
          states_serviced: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          contact_email: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          priority_map?: Json | null
          states_serviced?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          contact_email?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          priority_map?: Json | null
          states_serviced?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_rep_assignments: {
        Row: {
          created_at: string
          id: string
          pharmacy_id: string
          topline_rep_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pharmacy_id: string
          topline_rep_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pharmacy_id?: string
          topline_rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_rep_assignments_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_rep_assignments_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_shipping_rates: {
        Row: {
          created_at: string | null
          id: string
          pharmacy_id: string
          rate: number
          shipping_speed: Database["public"]["Enums"]["shipping_speed"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pharmacy_id: string
          rate: number
          shipping_speed: Database["public"]["Enums"]["shipping_speed"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pharmacy_id?: string
          rate?: number
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_shipping_rates_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_payment_methods: {
        Row: {
          account_last_five: string | null
          account_mask: string | null
          account_name: string | null
          account_type: string | null
          authorizenet_payment_profile_id: string | null
          authorizenet_profile_id: string | null
          bank_name: string | null
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_street: string | null
          billing_zip: string | null
          card_expiry: string | null
          card_last_five: string | null
          card_type: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          payment_type: string
          plaid_access_token: string | null
          plaid_access_token_encrypted: string | null
          plaid_account_id: string | null
          practice_id: string
          routing_number_last_four: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_last_five?: string | null
          account_mask?: string | null
          account_name?: string | null
          account_type?: string | null
          authorizenet_payment_profile_id?: string | null
          authorizenet_profile_id?: string | null
          bank_name?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          card_expiry?: string | null
          card_last_five?: string | null
          card_type?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          payment_type?: string
          plaid_access_token?: string | null
          plaid_access_token_encrypted?: string | null
          plaid_account_id?: string | null
          practice_id: string
          routing_number_last_four?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_last_five?: string | null
          account_mask?: string | null
          account_name?: string | null
          account_type?: string | null
          authorizenet_payment_profile_id?: string | null
          authorizenet_profile_id?: string | null
          bank_name?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          card_expiry?: string | null
          card_last_five?: string | null
          card_type?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          payment_type?: string
          plaid_access_token?: string | null
          plaid_access_token_encrypted?: string | null
          plaid_account_id?: string | null
          practice_id?: string
          routing_number_last_four?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_payment_methods_provider_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payment_methods_provider_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_refills: {
        Row: {
          created_at: string | null
          id: string
          new_order_line_id: string
          new_prescription_url: string | null
          new_refills_authorized: number | null
          original_order_line_id: string
          refill_number: number
          refilled_at: string | null
          refilled_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_order_line_id: string
          new_prescription_url?: string | null
          new_refills_authorized?: number | null
          original_order_line_id: string
          refill_number: number
          refilled_at?: string | null
          refilled_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          new_order_line_id?: string
          new_prescription_url?: string | null
          new_refills_authorized?: number | null
          original_order_line_id?: string
          refill_number?: number
          refilled_at?: string | null
          refilled_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_refills_new_order_line_id_fkey"
            columns: ["new_order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_refills_original_order_line_id_fkey"
            columns: ["original_order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pharmacies: {
        Row: {
          created_at: string | null
          id: string
          pharmacy_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pharmacy_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pharmacy_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_pharmacies_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pharmacies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_tiers: {
        Row: {
          base_price: number
          created_at: string | null
          downline_price: number
          id: string
          practice_price: number
          product_id: string
          topline_price: number
          updated_at: string | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          downline_price: number
          id?: string
          practice_price: number
          product_id: string
          topline_price: number
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          downline_price?: number
          id?: string
          practice_price?: number
          product_id?: string
          topline_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_rep_assignments: {
        Row: {
          created_at: string
          id: string
          product_id: string
          topline_rep_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          topline_rep_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          topline_rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_rep_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_rep_assignments_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean | null
          base_price: number
          created_at: string | null
          dosage: string | null
          downline_price: number | null
          id: string
          image_url: string | null
          name: string
          pharmacy_id: string | null
          product_type_id: string
          requires_prescription: boolean
          retail_price: number | null
          sig: string | null
          topline_price: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          base_price: number
          created_at?: string | null
          dosage?: string | null
          downline_price?: number | null
          id?: string
          image_url?: string | null
          name: string
          pharmacy_id?: string | null
          product_type_id: string
          requires_prescription?: boolean
          retail_price?: number | null
          sig?: string | null
          topline_price?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          base_price?: number
          created_at?: string | null
          dosage?: string | null
          downline_price?: number | null
          id?: string
          image_url?: string | null
          name?: string
          pharmacy_id?: string | null
          product_type_id?: string
          requires_prescription?: boolean
          retail_price?: number | null
          sig?: string | null
          topline_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_type_fk"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          address: string | null
          address_city: string | null
          address_encrypted: string | null
          address_formatted: string | null
          address_state: string | null
          address_street: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string | null
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_street: string | null
          billing_zip: string | null
          company: string | null
          contract_url: string | null
          created_at: string | null
          created_by: string | null
          dea: string | null
          dea_encrypted: string | null
          email: string
          email_encrypted: string | null
          full_name: string | null
          id: string
          license_number: string | null
          license_number_encrypted: string | null
          linked_topline_id: string | null
          name: string
          npi: string | null
          npi_encrypted: string | null
          parent_id: string | null
          phone: string | null
          phone_encrypted: string | null
          practice_npi: string | null
          shipping_address: string | null
          shipping_address_city: string | null
          shipping_address_formatted: string | null
          shipping_address_state: string | null
          shipping_address_street: string | null
          shipping_address_verification_source: string | null
          shipping_address_verification_status: string | null
          shipping_address_verified_at: string | null
          shipping_address_zip: string | null
          shipping_preference: string | null
          status: string | null
          temp_password: boolean | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          contract_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dea?: string | null
          dea_encrypted?: string | null
          email: string
          email_encrypted?: string | null
          full_name?: string | null
          id: string
          license_number?: string | null
          license_number_encrypted?: string | null
          linked_topline_id?: string | null
          name: string
          npi?: string | null
          npi_encrypted?: string | null
          parent_id?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          practice_npi?: string | null
          shipping_address?: string | null
          shipping_address_city?: string | null
          shipping_address_formatted?: string | null
          shipping_address_state?: string | null
          shipping_address_street?: string | null
          shipping_address_verification_source?: string | null
          shipping_address_verification_status?: string | null
          shipping_address_verified_at?: string | null
          shipping_address_zip?: string | null
          shipping_preference?: string | null
          status?: string | null
          temp_password?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          contract_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dea?: string | null
          dea_encrypted?: string | null
          email?: string
          email_encrypted?: string | null
          full_name?: string | null
          id?: string
          license_number?: string | null
          license_number_encrypted?: string | null
          linked_topline_id?: string | null
          name?: string
          npi?: string | null
          npi_encrypted?: string | null
          parent_id?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          practice_npi?: string | null
          shipping_address?: string | null
          shipping_address_city?: string | null
          shipping_address_formatted?: string | null
          shipping_address_state?: string | null
          shipping_address_street?: string | null
          shipping_address_verification_source?: string | null
          shipping_address_verification_status?: string | null
          shipping_address_verified_at?: string | null
          shipping_address_zip?: string | null
          shipping_preference?: string | null
          status?: string | null
          temp_password?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_topline_id_fkey"
            columns: ["linked_topline_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_topline_id_fkey"
            columns: ["linked_topline_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          practice_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          practice_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          practice_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "providers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_payment_batches: {
        Row: {
          batch_number: string
          created_at: string | null
          id: string
          notes: string | null
          paid_by: string
          payment_date: string
          payment_method: string | null
          total_amount: number
        }
        Insert: {
          batch_number: string
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by: string
          payment_date?: string
          payment_method?: string | null
          total_amount: number
        }
        Update: {
          batch_number?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by?: string
          payment_date?: string
          payment_method?: string | null
          total_amount?: number
        }
        Relationships: []
      }
      rep_payments: {
        Row: {
          amount_paid: number
          batch_id: string | null
          created_at: string | null
          date_range_end: string
          date_range_start: string
          id: string
          paid_at: string
          profit_ids: string[]
          topline_rep_id: string
        }
        Insert: {
          amount_paid: number
          batch_id?: string | null
          created_at?: string | null
          date_range_end: string
          date_range_start: string
          id?: string
          paid_at?: string
          profit_ids: string[]
          topline_rep_id: string
        }
        Update: {
          amount_paid?: number
          batch_id?: string | null
          created_at?: string | null
          date_range_end?: string
          date_range_start?: string
          id?: string
          paid_at?: string
          profit_ids?: string[]
          topline_rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "rep_payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_payments_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_practice_links: {
        Row: {
          assigned_topline_id: string | null
          created_at: string | null
          id: string
          practice_id: string
          rep_id: string
        }
        Insert: {
          assigned_topline_id?: string | null
          created_at?: string | null
          id?: string
          practice_id: string
          rep_id: string
        }
        Update: {
          assigned_topline_id?: string | null
          created_at?: string | null
          id?: string
          practice_id?: string
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_practice_links_assigned_topline_id_fkey"
            columns: ["assigned_topline_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_practice_links_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_practice_links_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_practice_links_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_product_price_overrides: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          override_downline_price: number | null
          override_retail_price: number | null
          override_topline_price: number | null
          product_id: string
          rep_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          override_downline_price?: number | null
          override_retail_price?: number | null
          override_topline_price?: number | null
          product_id: string
          rep_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          override_downline_price?: number | null
          override_retail_price?: number | null
          override_topline_price?: number | null
          product_id?: string
          rep_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_product_price_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_product_price_overrides_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_product_visibility: {
        Row: {
          created_at: string
          product_id: string
          topline_rep_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          product_id: string
          topline_rep_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          product_id?: string
          topline_rep_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rep_product_visibility_product_fk"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_product_visibility_topline_fk"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      reps: {
        Row: {
          active: boolean | null
          assigned_topline_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          assigned_topline_id?: string | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          assigned_topline_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reps_assigned_topline_id_fkey"
            columns: ["assigned_topline_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shipping_audit_logs: {
        Row: {
          change_description: string | null
          created_at: string
          id: string
          new_carrier: Database["public"]["Enums"]["shipping_carrier"] | null
          new_status: Database["public"]["Enums"]["order_status"] | null
          new_tracking_number: string | null
          old_carrier: Database["public"]["Enums"]["shipping_carrier"] | null
          old_status: Database["public"]["Enums"]["order_status"] | null
          old_tracking_number: string | null
          order_line_id: string
          updated_by: string
          updated_by_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          change_description?: string | null
          created_at?: string
          id?: string
          new_carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          new_status?: Database["public"]["Enums"]["order_status"] | null
          new_tracking_number?: string | null
          old_carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          old_tracking_number?: string | null
          order_line_id: string
          updated_by: string
          updated_by_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          change_description?: string | null
          created_at?: string
          id?: string
          new_carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          new_status?: Database["public"]["Enums"]["order_status"] | null
          new_tracking_number?: string | null
          old_carrier?: Database["public"]["Enums"]["shipping_carrier"] | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          old_tracking_number?: string | null
          order_line_id?: string
          updated_by?: string
          updated_by_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "shipping_audit_logs_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_audit_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_audit_logs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_codes: {
        Row: {
          attempt_count: number | null
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
      sms_verification_attempts: {
        Row: {
          attempt_count: number
          attempt_id: string
          code_hash: string
          created_at: string
          expires_at: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          attempt_id?: string
          code_hash: string
          created_at?: string
          expires_at: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          attempt_id?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      statuses: {
        Row: {
          active: boolean | null
          applicable_roles: string[]
          color: string | null
          created_at: string
          id: string
          name: string
          order_position: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          applicable_roles?: string[]
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_position?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          applicable_roles?: string[]
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_position?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          added_profiles: number
          added_roles: number
          admin_id: string | null
          created_at: string
          executed_at: string
          id: string
          orphaned_pharmacies_converted: number
          repaired_downlines: number
          repaired_pharmacies: number
          repaired_practices: number
          repaired_toplines: number
          summary: Json
          total_repaired: number
        }
        Insert: {
          added_profiles?: number
          added_roles?: number
          admin_id?: string | null
          created_at?: string
          executed_at?: string
          id?: string
          orphaned_pharmacies_converted?: number
          repaired_downlines?: number
          repaired_pharmacies?: number
          repaired_practices?: number
          repaired_toplines?: number
          summary?: Json
          total_repaired?: number
        }
        Update: {
          added_profiles?: number
          added_roles?: number
          admin_id?: string | null
          created_at?: string
          executed_at?: string
          id?: string
          orphaned_pharmacies_converted?: number
          repaired_downlines?: number
          repaired_pharmacies?: number
          repaired_practices?: number
          repaired_toplines?: number
          summary?: Json
          total_repaired?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      temp_password_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      terms_and_conditions: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          effective_date: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          title: string
          updated_at: string | null
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          title: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      thread_participants: {
        Row: {
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      two_fa_audit_log: {
        Row: {
          attempt_count: number | null
          attempt_id: string | null
          code_verified: boolean | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          phone: string
          response_time_ms: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          attempt_count?: number | null
          attempt_id?: string | null
          code_verified?: boolean | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          phone: string
          response_time_ms?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          attempt_count?: number | null
          attempt_id?: string | null
          code_verified?: boolean | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          phone?: string
          response_time_ms?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      two_fa_reset_logs: {
        Row: {
          created_at: string
          id: string
          previous_phone_number: string | null
          reason: string | null
          reset_by_email: string
          reset_by_user_id: string
          target_user_email: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          previous_phone_number?: string | null
          reason?: string | null
          reset_by_email: string
          reset_by_user_id: string
          target_user_email: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          previous_phone_number?: string | null
          reason?: string | null
          reset_by_email?: string
          reset_by_user_id?: string
          target_user_email?: string
          target_user_id?: string
        }
        Relationships: []
      }
      user_2fa_settings: {
        Row: {
          created_at: string
          enrolled_at: string | null
          ghl_enabled: boolean | null
          ghl_phone_verified: boolean | null
          id: string
          is_enrolled: boolean
          last_ghl_verification: string | null
          last_verified_at: string | null
          phone_number: string | null
          phone_number_encrypted: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          reset_at: string | null
          reset_requested_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrolled_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string
          is_enrolled?: boolean
          last_ghl_verification?: string | null
          last_verified_at?: string | null
          phone_number?: string | null
          phone_number_encrypted?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrolled_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string
          is_enrolled?: boolean
          last_ghl_verification?: string | null
          last_verified_at?: string | null
          phone_number?: string | null
          phone_number_encrypted?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_password_status: {
        Row: {
          created_at: string | null
          first_login_completed: boolean | null
          id: string
          must_change_password: boolean | null
          password_last_changed: string | null
          temporary_password_sent: boolean | null
          terms_accepted: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          first_login_completed?: boolean | null
          id?: string
          must_change_password?: boolean | null
          password_last_changed?: string | null
          temporary_password_sent?: boolean | null
          terms_accepted?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          first_login_completed?: boolean | null
          id?: string
          must_change_password?: boolean | null
          password_last_changed?: string | null
          temporary_password_sent?: boolean | null
          terms_accepted?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          csrf_token: string
          expires_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csrf_token: string
          expires_at: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csrf_token?: string
          expires_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_terms_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          role: Database["public"]["Enums"]["app_role"]
          signature_name: string
          signed_pdf_url: string
          terms_id: string
          terms_version: number
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          role: Database["public"]["Enums"]["app_role"]
          signature_name: string
          signed_pdf_url: string
          terms_id: string
          terms_version: number
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          signature_name?: string
          signed_pdf_url?: string
          terms_id?: string
          terms_version?: number
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_terms_acceptances_terms_id_fkey"
            columns: ["terms_id"]
            isOneToOne: false
            referencedRelation: "terms_and_conditions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      addresses_missing_state: {
        Row: {
          id: string | null
          missing_field: string | null
          record_name: string | null
          table_name: string | null
        }
        Relationships: []
      }
      cart_lines_masked: {
        Row: {
          cart_id: string | null
          created_at: string | null
          destination_state: string | null
          expires_at: string | null
          id: string | null
          order_notes: string | null
          patient_address_masked: string | null
          patient_email_masked: string | null
          patient_id: string | null
          patient_name: string | null
          patient_phone_masked: string | null
          prescription_method: string | null
          prescription_url_indicator: string | null
          price_snapshot: number | null
          product_id: string | null
          provider_id: string | null
          quantity: number | null
          refills_allowed: boolean | null
          refills_remaining: number | null
          refills_total: number | null
        }
        Insert: {
          cart_id?: string | null
          created_at?: string | null
          destination_state?: string | null
          expires_at?: string | null
          id?: string | null
          order_notes?: string | null
          patient_address_masked?: never
          patient_email_masked?: never
          patient_id?: string | null
          patient_name?: string | null
          patient_phone_masked?: never
          prescription_method?: string | null
          prescription_url_indicator?: never
          price_snapshot?: number | null
          product_id?: string | null
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
        }
        Update: {
          cart_id?: string | null
          created_at?: string | null
          destination_state?: string | null
          expires_at?: string | null
          id?: string | null
          order_notes?: string | null
          patient_address_masked?: never
          patient_email_masked?: never
          patient_id?: string | null
          patient_name?: string | null
          patient_phone_masked?: never
          prescription_method?: string | null
          prescription_url_indicator?: never
          price_snapshot?: number | null
          product_id?: string | null
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: boolean | null
          refills_remaining?: number | null
          refills_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_lines_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "cart"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_masked_for_reps: {
        Row: {
          active: boolean | null
          address: string | null
          address_city: string | null
          address_encrypted: string | null
          address_formatted: string | null
          address_state: string | null
          address_street: string | null
          address_verification_status: string | null
          address_zip: string | null
          company: string | null
          created_at: string | null
          dea: string | null
          dea_encrypted: string | null
          email: string | null
          email_encrypted: string | null
          full_name: string | null
          id: string | null
          license_number: string | null
          license_number_encrypted: string | null
          linked_topline_id: string | null
          name: string | null
          npi: string | null
          npi_encrypted: string | null
          parent_id: string | null
          phone: string | null
          phone_encrypted: string | null
          prescriber_name: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_status?: string | null
          address_zip?: string | null
          company?: string | null
          created_at?: string | null
          dea?: never
          dea_encrypted?: never
          email?: string | null
          email_encrypted?: string | null
          full_name?: never
          id?: string | null
          license_number?: never
          license_number_encrypted?: never
          linked_topline_id?: string | null
          name?: string | null
          npi?: never
          npi_encrypted?: never
          parent_id?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          prescriber_name?: never
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_verification_status?: string | null
          address_zip?: string | null
          company?: string | null
          created_at?: string | null
          dea?: never
          dea_encrypted?: never
          email?: string | null
          email_encrypted?: string | null
          full_name?: never
          id?: string | null
          license_number?: never
          license_number_encrypted?: never
          linked_topline_id?: string | null
          name?: string | null
          npi?: never
          npi_encrypted?: never
          parent_id?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          prescriber_name?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_topline_id_fkey"
            columns: ["linked_topline_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_topline_id_fkey"
            columns: ["linked_topline_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      user_2fa_settings_decrypted: {
        Row: {
          created_at: string | null
          ghl_enabled: boolean | null
          ghl_phone_verified: boolean | null
          id: string | null
          is_enrolled: boolean | null
          last_ghl_verification: string | null
          phone_number: string | null
          phone_verified: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string | null
          is_enrolled?: boolean | null
          last_ghl_verification?: string | null
          phone_number?: never
          phone_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string | null
          is_enrolled?: boolean | null
          last_ghl_verification?: string | null
          phone_number?: never
          phone_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_old_audit_logs: { Args: never; Returns: number }
      can_cancel_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      can_create_admin: { Args: { _inviter_id: string }; Returns: boolean }
      can_downline_view_practice: {
        Args: { _downline_user_id: string; _practice_id: string }
        Returns: boolean
      }
      can_topline_view_practice: {
        Args: { _practice_id: string; _topline_user_id: string }
        Returns: boolean
      }
      can_user_impersonate: { Args: { _user_id: string }; Returns: boolean }
      can_view_credentials: { Args: { _user_id: string }; Returns: boolean }
      check_refill_eligibility: {
        Args: { p_order_line_id: string }
        Returns: Json
      }
      cleanup_expired_cart_lines: { Args: never; Returns: number }
      cleanup_expired_csrf_tokens: { Args: never; Returns: number }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      cleanup_expired_sms_attempts: { Args: never; Returns: undefined }
      cleanup_expired_sms_codes: { Args: never; Returns: undefined }
      create_user_with_role:
        | {
            Args: {
              p_created_by?: string
              p_email: string
              p_name: string
              p_role: Database["public"]["Enums"]["app_role"]
              p_role_data?: Json
              p_status?: string
              p_temp_password?: boolean
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_email: string
              p_name: string
              p_role: Database["public"]["Enums"]["app_role"]
              p_role_data?: Json
              p_user_id: string
            }
            Returns: Json
          }
      decrypt_2fa_phone: {
        Args: { p_encrypted_phone: string }
        Returns: string
      }
      decrypt_cart_phi: {
        Args: { p_encrypted_data: string; p_field_type: string }
        Returns: string
      }
      decrypt_order_line_contact: {
        Args: { p_encrypted_data: string; p_field_type: string }
        Returns: string
      }
      decrypt_plaid_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      decrypt_prescriber_credential: {
        Args: { p_encrypted_data: string; p_field_type: string }
        Returns: string
      }
      decrypt_profile_contact: {
        Args: { p_encrypted_data: string; p_field_type: string }
        Returns: string
      }
      encrypt_plaid_token: { Args: { p_token: string }; Returns: string }
      get_auth_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_client_ip: { Args: never; Returns: string }
      get_current_user_rep_id: { Args: never; Returns: string }
      get_decrypted_order_line_contact: {
        Args: { p_order_line_id: string }
        Returns: {
          patient_address: string
          patient_email: string
          patient_phone: string
        }[]
      }
      get_decrypted_patient_phi: {
        Args: { p_patient_id: string }
        Returns: {
          allergies: string
          notes: string
        }[]
      }
      get_decrypted_practice_credentials: {
        Args: { p_practice_id: string }
        Returns: {
          dea: string
          license_number: string
          npi: string
        }[]
      }
      get_decrypted_provider_credentials: {
        Args: { p_provider_id: string }
        Returns: {
          dea: string
          license_number: string
          npi: string
        }[]
      }
      get_discount_code_stats: {
        Args: { p_code: string }
        Returns: {
          code: string
          total_discount_amount: number
          total_orders: number
          total_uses: number
        }[]
      }
      get_effective_product_price: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: {
          effective_downline_price: number
          effective_retail_price: number
          effective_topline_price: number
          has_override: boolean
          override_source: string
        }[]
      }
      get_encryption_coverage: {
        Args: never
        Returns: {
          coverage_percentage: number
          data_type: string
          encrypted_records: number
          total_records: number
        }[]
      }
      get_my_topline_rep_id: { Args: never; Returns: string }
      get_security_events_summary: {
        Args: never
        Returns: {
          action_type: string
          event_count: number
          last_occurrence: string
          unique_users: number
        }[]
      }
      get_topline_rep_id_for_practice: {
        Args: { _practice_linked_topline_user_id: string }
        Returns: string
      }
      get_unread_message_count: { Args: { p_user_id: string }; Returns: number }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_rep_id: { Args: { _user_id: string }; Returns: string }
      get_visible_products_for_effective_user: {
        Args: { p_effective_user_id: string }
        Returns: {
          id: string
        }[]
      }
      get_visible_products_for_user: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_discount_usage: { Args: { p_code: string }; Returns: undefined }
      is_admin_ip_banned: { Args: never; Returns: boolean }
      is_cart_owner: {
        Args: { _cart_id: string; _user_id: string }
        Returns: boolean
      }
      is_downline_of_topline: {
        Args: { _topline_user_id: string }
        Returns: boolean
      }
      is_thread_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_topline_of_rep: { Args: { _rep_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type?: string
        }
        Returns: string
      }
      log_patient_phi_access: {
        Args: {
          p_accessed_fields: Json
          p_component_context: string
          p_patient_id: string
          p_patient_name: string
          p_relationship: string
          p_viewer_role: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      recompute_order_profits: {
        Args: { p_order_ids?: string[]; p_status_filter?: string[] }
        Returns: {
          message: string
          recomputed_count: number
        }[]
      }
      refresh_security_events_summary: { Args: never; Returns: undefined }
      sync_practice_address_to_providers: {
        Args: { p_practice_id: string }
        Returns: undefined
      }
      validate_discount_code: {
        Args: { p_code: string }
        Returns: {
          discount_percentage: number
          message: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "doctor"
        | "pharmacy"
        | "topline"
        | "downline"
        | "provider"
      notification_type:
        | "message"
        | "order_status"
        | "order_shipped"
        | "order_delivered"
        | "order_issue"
        | "account_alert"
        | "system_announcement"
        | "payment_method"
        | "practice_approved"
        | "rep_approved"
        | "low_inventory"
      order_status:
        | "pending"
        | "filled"
        | "shipped"
        | "denied"
        | "change_requested"
        | "delivered"
        | "declined"
        | "on_hold"
      payment_status: "pending" | "completed"
      shipping_carrier: "fedex" | "ups" | "usps" | "amazon"
      shipping_speed: "ground" | "2day" | "overnight"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "doctor",
        "pharmacy",
        "topline",
        "downline",
        "provider",
      ],
      notification_type: [
        "message",
        "order_status",
        "order_shipped",
        "order_delivered",
        "order_issue",
        "account_alert",
        "system_announcement",
        "payment_method",
        "practice_approved",
        "rep_approved",
        "low_inventory",
      ],
      order_status: [
        "pending",
        "filled",
        "shipped",
        "denied",
        "change_requested",
        "delivered",
        "declined",
        "on_hold",
      ],
      payment_status: ["pending", "completed"],
      shipping_carrier: ["fedex", "ups", "usps", "amazon"],
      shipping_speed: ["ground", "2day", "overnight"],
    },
  },
} as const
