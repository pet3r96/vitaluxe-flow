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
      active_impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          expires_at: string
          id: string
          impersonated_role: string
          impersonated_user_id: string | null
          impersonated_user_name: string | null
          impersonation_log_id: string | null
          last_activity: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          impersonated_role: string
          impersonated_user_id?: string | null
          impersonated_user_name?: string | null
          impersonation_log_id?: string | null
          last_activity?: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          impersonated_role?: string
          impersonated_user_id?: string | null
          impersonated_user_name?: string | null
          impersonation_log_id?: string | null
          last_activity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_impersonation_sessions_impersonation_log_id_fkey"
            columns: ["impersonation_log_id"]
            isOneToOne: false
            referencedRelation: "impersonation_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alerts: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          pharmacy_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          pharmacy_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          pharmacy_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_alerts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_ip_banlist: {
        Row: {
          banned: boolean
          banned_at: string
          banned_by: string
          banned_reason: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          ip_address: string
          updated_at: string
        }
        Insert: {
          banned?: boolean
          banned_at?: string
          banned_by: string
          banned_reason: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address: string
          updated_at?: string
        }
        Update: {
          banned?: boolean
          banned_at?: string
          banned_by?: string
          banned_reason?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          message: string
          severity: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          message: string
          severity: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          message?: string
          severity?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      amazon_tracking_api_calls: {
        Row: {
          called_at: string
          created_at: string
          id: string
          order_id: string
          order_line_id: string | null
          response_status: string | null
        }
        Insert: {
          called_at?: string
          created_at?: string
          id?: string
          order_id: string
          order_line_id?: string | null
          response_status?: string | null
        }
        Update: {
          called_at?: string
          created_at?: string
          id?: string
          order_id?: string
          order_line_id?: string | null
          response_status?: string | null
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
          cost_per_call: number
          created_at: string
          id: string
          rate_limit: number | null
        }
        Insert: {
          api_name: string
          cost_per_call?: number
          created_at?: string
          id?: string
          rate_limit?: number | null
        }
        Update: {
          api_name?: string
          cost_per_call?: number
          created_at?: string
          id?: string
          rate_limit?: number | null
        }
        Relationships: []
      }
      appointment_service_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          typical_duration_minutes: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          typical_duration_minutes?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          typical_duration_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          correlation_id: string | null
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
          correlation_id?: string | null
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
          correlation_id?: string | null
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
          archived_at: string | null
          correlation_id: string | null
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
          archived_at?: string | null
          correlation_id?: string | null
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
          archived_at?: string | null
          correlation_id?: string | null
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
      calendar_sync_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          token?: string
          user_id?: string
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
      cart_lines: {
        Row: {
          assigned_pharmacy_id: string | null
          cart_id: string
          created_at: string | null
          custom_dosage: string | null
          custom_dosage_encrypted: string | null
          custom_sig: string | null
          custom_sig_encrypted: string | null
          days_supply: number | null
          destination_state: string
          expires_at: string | null
          gender_at_birth: string | null
          id: string
          order_notes: string | null
          patient_address: string | null
          patient_address_city: string | null
          patient_address_encrypted: string | null
          patient_address_formatted: string | null
          patient_address_state: string | null
          patient_address_street: string | null
          patient_address_validated: boolean | null
          patient_address_validation_source: string | null
          patient_address_zip: string | null
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
          ship_to: string | null
          shipping_speed: Database["public"]["Enums"]["shipping_speed"] | null
          variant_id: string | null
        }
        Insert: {
          assigned_pharmacy_id?: string | null
          cart_id: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          days_supply?: number | null
          destination_state: string
          expires_at?: string | null
          gender_at_birth?: string | null
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_address_city?: string | null
          patient_address_encrypted?: string | null
          patient_address_formatted?: string | null
          patient_address_state?: string | null
          patient_address_street?: string | null
          patient_address_validated?: boolean | null
          patient_address_validation_source?: string | null
          patient_address_zip?: string | null
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
          ship_to?: string | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"] | null
          variant_id?: string | null
        }
        Update: {
          assigned_pharmacy_id?: string | null
          cart_id?: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          days_supply?: number | null
          destination_state?: string
          expires_at?: string | null
          gender_at_birth?: string | null
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_address_city?: string | null
          patient_address_encrypted?: string | null
          patient_address_formatted?: string | null
          patient_address_state?: string | null
          patient_address_street?: string | null
          patient_address_validated?: boolean | null
          patient_address_validation_source?: string | null
          patient_address_zip?: string | null
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
          ship_to?: string | null
          shipping_speed?: Database["public"]["Enums"]["shipping_speed"] | null
          variant_id?: string | null
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
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
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
          {
            foreignKeyName: "cart_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_rotation_schedule: {
        Row: {
          cert_name: string
          created_at: string | null
          id: string
          last_rotated_at: string
          rotation_interval_days: number
        }
        Insert: {
          cert_name: string
          created_at?: string | null
          id?: string
          last_rotated_at?: string
          rotation_interval_days?: number
        }
        Update: {
          cert_name?: string
          created_at?: string | null
          id?: string
          last_rotated_at?: string
          rotation_interval_days?: number
        }
        Relationships: []
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
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_percentage: number
          id: string
          max_uses: number | null
          max_uses_per_user: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_percentage: number
          id?: string
          max_uses?: number | null
          max_uses_per_user?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_percentage?: number
          id?: string
          max_uses?: number | null
          max_uses_per_user?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      error_logs_archive: {
        Row: {
          archived_at: string | null
          created_at: string | null
          details: Json | null
          error_message: string | null
          error_stack: string | null
          id: string
          original_log_id: string | null
          practice_id: string | null
          severity: string | null
          source: string | null
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          original_log_id?: string | null
          practice_id?: string | null
          severity?: string | null
          source?: string | null
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          error_stack?: string | null
          id?: string
          original_log_id?: string | null
          practice_id?: string | null
          severity?: string | null
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      function_rate_limits: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
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
          start_time: string
          target_role: string
          target_user_email: string
          target_user_id: string | null
          target_user_name: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          impersonator_email: string
          impersonator_id: string
          start_time?: string
          target_role: string
          target_user_email: string
          target_user_id?: string | null
          target_user_name: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          impersonator_email?: string
          impersonator_id?: string
          start_time?: string
          target_role?: string
          target_user_email?: string
          target_user_id?: string | null
          target_user_name?: string
        }
        Relationships: []
      }
      internal_message_recipients: {
        Row: {
          created_at: string
          id: string
          message_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "internal_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_message_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_message_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          body: string
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          message_type: string
          patient_id: string | null
          practice_id: string
          priority: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          message_type?: string
          patient_id?: string | null
          practice_id: string
          priority?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message_type?: string
          patient_id?: string | null
          practice_id?: string
          priority?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "internal_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "internal_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "internal_messages_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_vault_audit_logs: {
        Row: {
          action_type: string
          change_summary: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_values: Json | null
          patient_account_id: string
          performed_by_user_id: string | null
          practice_id: string
          previous_values: Json | null
          record_id: string | null
        }
        Insert: {
          action_type: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          patient_account_id: string
          performed_by_user_id?: string | null
          practice_id: string
          previous_values?: Json | null
          record_id?: string | null
        }
        Update: {
          action_type?: string
          change_summary?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_values?: Json | null
          patient_account_id?: string
          performed_by_user_id?: string | null
          practice_id?: string
          previous_values?: Json | null
          record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_medical_vault_audit_logs_practice"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_medical_vault_audit_logs_practice"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "medical_vault_audit_logs_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      medical_vault_audit_logs_archive: {
        Row: {
          action_type: string | null
          archived_at: string | null
          change_summary: string | null
          changed_by_user_id: string | null
          created_at: string | null
          entity_id: string | null
          id: string
          original_log_id: string | null
          patient_account_id: string | null
        }
        Insert: {
          action_type?: string | null
          archived_at?: string | null
          change_summary?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          original_log_id?: string | null
          patient_account_id?: string | null
        }
        Update: {
          action_type?: string | null
          archived_at?: string | null
          change_summary?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          original_log_id?: string | null
          patient_account_id?: string | null
        }
        Relationships: []
      }
      medical_vault_share_links: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          patient_account_id: string
          share_token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          patient_account_id: string
          share_token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          patient_account_id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_vault_share_links_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "medical_vault_share_links_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_share_links_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_vault_share_links_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "medical_vault_share_links_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      message_thread_read_status: {
        Row: {
          created_at: string | null
          id: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
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
          created_at: string
          created_by: string
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          subject: string
          thread_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          subject: string
          thread_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          subject?: string
          thread_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
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
      notification_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          notification_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          notification_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          notification_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channels: Json | null
          created_at: string | null
          email_enabled: boolean | null
          event_type: string
          id: string
          in_app_enabled: boolean | null
          role: string | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channels?: Json | null
          created_at?: string | null
          email_enabled?: boolean | null
          event_type: string
          id?: string
          in_app_enabled?: boolean | null
          role?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channels?: Json | null
          created_at?: string | null
          email_enabled?: boolean | null
          event_type?: string
          id?: string
          in_app_enabled?: boolean | null
          role?: string | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          max_retries: number
          message: string
          metadata: Json | null
          notification_type: string
          processed_at: string | null
          retry_count: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          message: string
          metadata?: Json | null
          notification_type: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number
          message?: string
          metadata?: Json | null
          notification_type?: string
          processed_at?: string | null
          retry_count?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean | null
          channel: string
          created_at: string | null
          event_type: string
          id: string
          is_default: boolean | null
          message_template: string
          practice_id: string | null
          subject: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          active?: boolean | null
          channel: string
          created_at?: string | null
          event_type: string
          id?: string
          is_default?: boolean | null
          message_template: string
          practice_id?: string | null
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          active?: boolean | null
          channel?: string
          created_at?: string | null
          event_type?: string
          id?: string
          is_default?: boolean | null
          message_template?: string
          practice_id?: string | null
          subject?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
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
      notifications_sent: {
        Row: {
          created_at: string
          entity_id: string
          event_type: string
          id: string
          message_id: string | null
          metadata: Json | null
          recipient: string
          sent_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_type: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient: string
          sent_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_type?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient?: string
          sent_at?: string
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
          days_supply: number | null
          delivered_at: string | null
          destination_state: string | null
          discount_amount: number | null
          discount_percentage: number | null
          gender_at_birth: string | null
          id: string
          is_refill: boolean | null
          last_status_update_at: string | null
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
          pharmacy_order_id: string | null
          pharmacy_order_metadata: Json | null
          prescription_method: string | null
          prescription_url: string | null
          prescription_url_encrypted: string | null
          price: number
          price_before_discount: number | null
          processing_at: string | null
          product_id: string | null
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
          variant_id: string | null
        }
        Insert: {
          assigned_pharmacy_id?: string | null
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          days_supply?: number | null
          delivered_at?: string | null
          destination_state?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          gender_at_birth?: string | null
          id?: string
          is_refill?: boolean | null
          last_status_update_at?: string | null
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
          pharmacy_order_id?: string | null
          pharmacy_order_metadata?: Json | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id?: string | null
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
          variant_id?: string | null
        }
        Update: {
          assigned_pharmacy_id?: string | null
          created_at?: string | null
          custom_dosage?: string | null
          custom_dosage_encrypted?: string | null
          custom_sig?: string | null
          custom_sig_encrypted?: string | null
          days_supply?: number | null
          delivered_at?: string | null
          destination_state?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          gender_at_birth?: string | null
          id?: string
          is_refill?: boolean | null
          last_status_update_at?: string | null
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
          pharmacy_order_id?: string | null
          pharmacy_order_metadata?: Json | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price?: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id?: string | null
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
          variant_id?: string | null
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
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
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
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "order_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
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
          {
            foreignKeyName: "order_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_profits: {
        Row: {
          admin_profit: number | null
          created_at: string
          downline_id: string | null
          downline_profit: number | null
          id: string
          order_id: string
          order_total: number
          payment_status: string | null
          topline_id: string | null
          topline_profit: number
          updated_at: string
        }
        Insert: {
          admin_profit?: number | null
          created_at?: string
          downline_id?: string | null
          downline_profit?: number | null
          id?: string
          order_id: string
          order_total: number
          payment_status?: string | null
          topline_id?: string | null
          topline_profit?: number
          updated_at?: string
        }
        Update: {
          admin_profit?: number | null
          created_at?: string
          downline_id?: string | null
          downline_profit?: number | null
          id?: string
          order_id?: string
          order_total?: number
          payment_status?: string | null
          topline_id?: string | null
          topline_profit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_profits_downline_id_fkey"
            columns: ["downline_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
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
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_profits_topline_id_fkey"
            columns: ["topline_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
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
      order_status_configs: {
        Row: {
          color_class: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          is_system_default: boolean
          sort_order: number
          status_key: string
          updated_at: string
        }
        Insert: {
          color_class?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          sort_order?: number
          status_key: string
          updated_at?: string
        }
        Update: {
          color_class?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          sort_order?: number
          status_key?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
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
          patient_id: string | null
          payment_method_id: string | null
          payment_method_used: string | null
          payment_status: string | null
          practice_address: string | null
          practice_id: string | null
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
          patient_id?: string | null
          payment_method_id?: string | null
          payment_method_used?: string | null
          payment_status?: string | null
          practice_address?: string | null
          practice_id?: string | null
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
          patient_id?: string | null
          payment_method_id?: string | null
          payment_method_used?: string | null
          payment_status?: string | null
          practice_address?: string | null
          practice_id?: string | null
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
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "practice_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      orphan_storage_files: {
        Row: {
          bucket_id: string
          file_size: number | null
          id: string
          logged_at: string | null
          mime_type: string | null
          reason: string | null
          storage_created_at: string | null
          storage_path: string
        }
        Insert: {
          bucket_id: string
          file_size?: number | null
          id?: string
          logged_at?: string | null
          mime_type?: string | null
          reason?: string | null
          storage_created_at?: string | null
          storage_path: string
        }
        Update: {
          bucket_id?: string
          file_size?: number | null
          id?: string
          logged_at?: string | null
          mime_type?: string | null
          reason?: string | null
          storage_created_at?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_accounts: {
        Row: {
          address: string | null
          address_city: string | null
          address_formatted: string | null
          address_state: string | null
          address_street: string | null
          address_suite: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string | null
          allergies: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          driver_license_number: string | null
          driver_license_state: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender_at_birth: string | null
          id: string
          intake_completed_at: string | null
          intake_reminder_dismissed_at: string | null
          invitation_sent_at: string | null
          last_login_at: string | null
          last_name: string
          name: string | null
          notes: string | null
          phone: string | null
          practice_id: string
          primary_provider_id: string | null
          provider_id: string | null
          state: string | null
          state_issued_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          allergies?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          driver_license_number?: string | null
          driver_license_state?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender_at_birth?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_reminder_dismissed_at?: string | null
          invitation_sent_at?: string | null
          last_login_at?: string | null
          last_name: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          practice_id: string
          primary_provider_id?: string | null
          provider_id?: string | null
          state?: string | null
          state_issued_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          allergies?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          driver_license_number?: string | null
          driver_license_state?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender_at_birth?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_reminder_dismissed_at?: string | null
          invitation_sent_at?: string | null
          last_login_at?: string | null
          last_name?: string
          name?: string | null
          notes?: string | null
          phone?: string | null
          practice_id?: string
          primary_provider_id?: string | null
          provider_id?: string | null
          state?: string | null
          state_issued_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_appointments: {
        Row: {
          appointment_type: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          checked_in_at: string | null
          completed_at: string | null
          confirmation_type: string | null
          created_at: string
          end_time: string
          id: string
          modified_at: string | null
          modified_by: string | null
          notes: string | null
          patient_id: string
          practice_id: string
          provider_id: string | null
          reason_for_visit: string | null
          requested_date: string | null
          requested_time: string | null
          reschedule_reason: string | null
          reschedule_requested_at: string | null
          room_id: string | null
          service_description: string | null
          service_type: string | null
          start_time: string
          status: string
          treatment_started_at: string | null
          updated_at: string
          video_session_id: string | null
          visit_summary_url: string | null
          visit_type: string | null
        }
        Insert: {
          appointment_type: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          confirmation_type?: string | null
          created_at?: string
          end_time: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          patient_id: string
          practice_id: string
          provider_id?: string | null
          reason_for_visit?: string | null
          requested_date?: string | null
          requested_time?: string | null
          reschedule_reason?: string | null
          reschedule_requested_at?: string | null
          room_id?: string | null
          service_description?: string | null
          service_type?: string | null
          start_time: string
          status?: string
          treatment_started_at?: string | null
          updated_at?: string
          video_session_id?: string | null
          visit_summary_url?: string | null
          visit_type?: string | null
        }
        Update: {
          appointment_type?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          checked_in_at?: string | null
          completed_at?: string | null
          confirmation_type?: string | null
          created_at?: string
          end_time?: string
          id?: string
          modified_at?: string | null
          modified_by?: string | null
          notes?: string | null
          patient_id?: string
          practice_id?: string
          provider_id?: string | null
          reason_for_visit?: string | null
          requested_date?: string | null
          requested_time?: string | null
          reschedule_reason?: string | null
          reschedule_requested_at?: string | null
          room_id?: string | null
          service_description?: string | null
          service_type?: string | null
          start_time?: string
          status?: string
          treatment_started_at?: string | null
          updated_at?: string
          video_session_id?: string | null
          visit_summary_url?: string | null
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_video_session"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "practice_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_appointments_video_session_id_fkey"
            columns: ["video_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_size: number | null
          hidden_by_patient: boolean
          id: string
          mime_type: string | null
          notes: string | null
          patient_id: string
          share_with_practice: boolean
          storage_path: string
          storage_provider: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_size?: number | null
          hidden_by_patient?: boolean
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id: string
          share_with_practice?: boolean
          storage_path: string
          storage_provider?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_size?: number | null
          hidden_by_patient?: boolean
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id?: string
          share_with_practice?: boolean
          storage_path?: string
          storage_provider?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_follow_ups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          due_date: string
          follow_up_date: string | null
          follow_up_time: string | null
          id: string
          notes: string | null
          patient_id: string
          practice_id: string
          priority: string | null
          reason: string | null
          status: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date: string
          follow_up_date?: string | null
          follow_up_time?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          practice_id: string
          priority?: string | null
          reason?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string
          follow_up_date?: string | null
          follow_up_time?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          practice_id?: string
          priority?: string | null
          reason?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_follow_ups_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_follow_ups_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medical_vault: {
        Row: {
          active: boolean
          allergies: Json | null
          attachments: Json | null
          blood_type: string | null
          created_at: string
          created_by_user_id: string | null
          current_medications: Json | null
          date_recorded: string | null
          description: string | null
          id: string
          medical_conditions: Json | null
          metadata: Json | null
          patient_account_id: string | null
          patient_id: string
          practice_id: string
          primary_value: string | null
          provider_id: string | null
          record_data: Json | null
          record_type: string
          title: string
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          active?: boolean
          allergies?: Json | null
          attachments?: Json | null
          blood_type?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_medications?: Json | null
          date_recorded?: string | null
          description?: string | null
          id?: string
          medical_conditions?: Json | null
          metadata?: Json | null
          patient_account_id?: string | null
          patient_id: string
          practice_id: string
          primary_value?: string | null
          provider_id?: string | null
          record_data?: Json | null
          record_type: string
          title: string
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          active?: boolean
          allergies?: Json | null
          attachments?: Json | null
          blood_type?: string | null
          created_at?: string
          created_by_user_id?: string | null
          current_medications?: Json | null
          date_recorded?: string | null
          description?: string | null
          id?: string
          medical_conditions?: Json | null
          metadata?: Json | null
          patient_account_id?: string | null
          patient_id?: string
          practice_id?: string
          primary_value?: string | null
          provider_id?: string | null
          record_data?: Json | null
          record_type?: string
          title?: string
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_patient_medical_vault_practice"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_patient_medical_vault_practice"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medical_vault_history: {
        Row: {
          change_type: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          patient_account_id: string
          vault_record_id: string
        }
        Insert: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          patient_account_id: string
          vault_record_id: string
        }
        Update: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          patient_account_id?: string
          vault_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_medical_vault_history_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_history_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_history_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_medical_vault_history_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_history_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_medical_vault_history_vault_record_id_fkey"
            columns: ["vault_record_id"]
            isOneToOne: false
            referencedRelation: "patient_medical_vault"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_message_id: string | null
          patient_id: string
          practice_id: string
          read_at: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          sender_type: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_message_id?: string | null
          patient_id: string
          practice_id: string
          read_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          sender_type: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_message_id?: string | null
          patient_id?: string
          practice_id?: string
          read_at?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          sender_type?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "patient_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_messages_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_messages_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_messages_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_notes: {
        Row: {
          created_at: string | null
          created_by_name: string | null
          created_by_role: string | null
          created_by_user_id: string | null
          id: string
          is_active: boolean | null
          note_content: string
          patient_account_id: string
          share_with_patient: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean | null
          note_content: string
          patient_account_id: string
          share_with_patient?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean | null
          note_content?: string
          patient_account_id?: string
          share_with_patient?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patient_notes_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patient_notes_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      patient_portal_terms: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      patients: {
        Row: {
          created_at: string
          id: string
          patient_account_id: string
          practice_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          patient_account_id: string
          practice_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          patient_account_id?: string
          practice_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: true
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patients_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: true
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: true
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: true
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "patients_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: true
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_practices: {
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
          admin_notes: string | null
          assigned_rep_user_id: string | null
          city: string | null
          company: string | null
          contract_file: string | null
          created_at: string
          created_by_role: string
          created_by_user_id: string
          dea: string | null
          email: string | null
          id: string
          license_number: string | null
          notes: string | null
          npi: string | null
          phone: string | null
          practice_name: string
          prescriber_dea: string | null
          prescriber_email: string | null
          prescriber_full_name: string | null
          prescriber_license: string | null
          prescriber_name: string | null
          prescriber_npi: string | null
          prescriber_phone: string | null
          prescriber_specialty: string | null
          prescriber_state: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
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
          admin_notes?: string | null
          assigned_rep_user_id?: string | null
          city?: string | null
          company?: string | null
          contract_file?: string | null
          created_at?: string
          created_by_role: string
          created_by_user_id: string
          dea?: string | null
          email?: string | null
          id?: string
          license_number?: string | null
          notes?: string | null
          npi?: string | null
          phone?: string | null
          practice_name: string
          prescriber_dea?: string | null
          prescriber_email?: string | null
          prescriber_full_name?: string | null
          prescriber_license?: string | null
          prescriber_name?: string | null
          prescriber_npi?: string | null
          prescriber_phone?: string | null
          prescriber_specialty?: string | null
          prescriber_state?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
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
          admin_notes?: string | null
          assigned_rep_user_id?: string | null
          city?: string | null
          company?: string | null
          contract_file?: string | null
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string
          dea?: string | null
          email?: string | null
          id?: string
          license_number?: string | null
          notes?: string | null
          npi?: string | null
          phone?: string | null
          practice_name?: string
          prescriber_dea?: string | null
          prescriber_email?: string | null
          prescriber_full_name?: string | null
          prescriber_license?: string | null
          prescriber_name?: string | null
          prescriber_npi?: string | null
          prescriber_phone?: string | null
          prescriber_specialty?: string | null
          prescriber_state?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      pending_product_requests: {
        Row: {
          category: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          dosage: string | null
          id: string
          ingredients: string | null
          name: string
          ndc: string | null
          pharmacy_id: string | null
          practice_id: string | null
          product_type_id: string | null
          product_type_name: string | null
          rejection_reason: string | null
          request_source: string
          requires_prescription: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          unit_price: number | null
          updated_at: string
          vitaluxe_price: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          dosage?: string | null
          id?: string
          ingredients?: string | null
          name: string
          ndc?: string | null
          pharmacy_id?: string | null
          practice_id?: string | null
          product_type_id?: string | null
          product_type_name?: string | null
          rejection_reason?: string | null
          request_source?: string
          requires_prescription?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          unit_price?: number | null
          updated_at?: string
          vitaluxe_price?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          dosage?: string | null
          id?: string
          ingredients?: string | null
          name?: string
          ndc?: string | null
          pharmacy_id?: string | null
          practice_id?: string | null
          product_type_id?: string | null
          product_type_name?: string | null
          rejection_reason?: string | null
          request_source?: string
          requires_prescription?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          unit_price?: number | null
          updated_at?: string
          vitaluxe_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_product_requests_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_product_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_product_requests_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_product_requests_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_reps: {
        Row: {
          admin_notes: string | null
          assigned_topline_user_id: string | null
          company: string | null
          created_at: string
          created_by_role: string
          created_by_user_id: string
          email: string
          full_name: string
          id: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          role: string
          status: string
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_topline_user_id?: string | null
          company?: string | null
          created_at?: string
          created_by_role: string
          created_by_user_id: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          role: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_topline_user_id?: string | null
          company?: string | null
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          role?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      penetration_test_results: {
        Row: {
          actual_result: string
          attack_vector: string
          created_at: string
          error_message: string | null
          expected_result: string
          id: string
          notes: string | null
          practice_id: string | null
          sql_trace: string | null
          success: boolean
          target_bucket: string | null
          target_function: string | null
          target_table: string | null
          test_category: string
          test_name: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          actual_result: string
          attack_vector: string
          created_at?: string
          error_message?: string | null
          expected_result: string
          id?: string
          notes?: string | null
          practice_id?: string | null
          sql_trace?: string | null
          success: boolean
          target_bucket?: string | null
          target_function?: string | null
          target_table?: string | null
          test_category: string
          test_name: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          actual_result?: string
          attack_vector?: string
          created_at?: string
          error_message?: string | null
          expected_result?: string
          id?: string
          notes?: string | null
          practice_id?: string | null
          sql_trace?: string | null
          success?: boolean
          target_bucket?: string | null
          target_function?: string | null
          target_table?: string | null
          test_category?: string
          test_name?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          connection_type: string | null
          created_at: string | null
          id: string
          load_time_ms: number
          metric_type: string
          metric_value: number | null
          page_name: string
          timestamp: string
          user_agent: string | null
          user_id: string | null
          user_role: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          load_time_ms: number
          metric_type: string
          metric_value?: number | null
          page_name: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string | null
          id?: string
          load_time_ms?: number
          metric_type?: string
          metric_value?: number | null
          page_name?: string
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
          user_role?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
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
          address_suite: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_verified_at: string | null
          address_zip: string | null
          api_auth_key_name: string | null
          api_auth_type: string | null
          api_client_id: string | null
          api_client_secret_encrypted: string | null
          api_custom_headers: Json | null
          api_enabled: boolean | null
          api_endpoint_url: string | null
          api_environment: string | null
          api_handler_type: string | null
          api_http_method: string | null
          api_payload_template: Json | null
          api_production_endpoint_url: string | null
          api_retry_count: number | null
          api_sandbox_endpoint_url: string | null
          api_status_mapping: Json | null
          api_test_mode: boolean
          api_timeout_seconds: number | null
          api_token_endpoint_url: string | null
          contact_email: string
          created_at: string | null
          id: string
          inbound_webhook_enabled: boolean | null
          inbound_webhook_path: string | null
          name: string
          parent_id: string | null
          phone: string | null
          priority_map: Json | null
          states_serviced: string[] | null
          updated_at: string | null
          user_id: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          api_auth_key_name?: string | null
          api_auth_type?: string | null
          api_client_id?: string | null
          api_client_secret_encrypted?: string | null
          api_custom_headers?: Json | null
          api_enabled?: boolean | null
          api_endpoint_url?: string | null
          api_environment?: string | null
          api_handler_type?: string | null
          api_http_method?: string | null
          api_payload_template?: Json | null
          api_production_endpoint_url?: string | null
          api_retry_count?: number | null
          api_sandbox_endpoint_url?: string | null
          api_status_mapping?: Json | null
          api_test_mode?: boolean
          api_timeout_seconds?: number | null
          api_token_endpoint_url?: string | null
          contact_email: string
          created_at?: string | null
          id?: string
          inbound_webhook_enabled?: boolean | null
          inbound_webhook_path?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          priority_map?: Json | null
          states_serviced?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
          address_verification_source?: string | null
          address_verification_status?: string | null
          address_verified_at?: string | null
          address_zip?: string | null
          api_auth_key_name?: string | null
          api_auth_type?: string | null
          api_client_id?: string | null
          api_client_secret_encrypted?: string | null
          api_custom_headers?: Json | null
          api_enabled?: boolean | null
          api_endpoint_url?: string | null
          api_environment?: string | null
          api_handler_type?: string | null
          api_http_method?: string | null
          api_payload_template?: Json | null
          api_production_endpoint_url?: string | null
          api_retry_count?: number | null
          api_sandbox_endpoint_url?: string | null
          api_status_mapping?: Json | null
          api_test_mode?: boolean
          api_timeout_seconds?: number | null
          api_token_endpoint_url?: string | null
          contact_email?: string
          created_at?: string | null
          id?: string
          inbound_webhook_enabled?: boolean | null
          inbound_webhook_path?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          priority_map?: Json | null
          states_serviced?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
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
      pharmacy_api_credentials: {
        Row: {
          created_at: string | null
          credential_key: string
          credential_key_encrypted: string | null
          credential_type: string
          id: string
          pharmacy_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_key: string
          credential_key_encrypted?: string | null
          credential_type: string
          id?: string
          pharmacy_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_key?: string
          credential_key_encrypted?: string | null
          credential_type?: string
          id?: string
          pharmacy_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_api_credentials_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_api_tokens: {
        Row: {
          access_token: string
          created_at: string
          environment: string
          expires_at: string
          id: string
          pharmacy_id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          environment: string
          expires_at: string
          id?: string
          pharmacy_id: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          environment?: string
          expires_at?: string
          id?: string
          pharmacy_id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_api_tokens_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_idempotency_keys: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          order_id: string
          order_line_id: string | null
          pharmacy_id: string
          pharmacy_order_id: string | null
          request_hash: string
          response_body: Json | null
          response_status: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          order_id: string
          order_line_id?: string | null
          pharmacy_id: string
          pharmacy_order_id?: string | null
          request_hash: string
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          order_id?: string
          order_line_id?: string | null
          pharmacy_id?: string
          pharmacy_order_id?: string | null
          request_hash?: string
          response_body?: Json | null
          response_status?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_idempotency_keys_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_order_jobs: {
        Row: {
          attempt_count: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number | null
          order_id: string
          order_line_id: string
          pharmacy_id: string
          pharmacy_response: Json | null
          status: string
        }
        Insert: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number | null
          order_id: string
          order_line_id: string
          pharmacy_id: string
          pharmacy_response?: Json | null
          status?: string
        }
        Update: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number | null
          order_id?: string
          order_line_id?: string
          pharmacy_id?: string
          pharmacy_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_order_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_jobs_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: true
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_jobs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_order_transmissions: {
        Row: {
          api_endpoint: string
          created_at: string | null
          error_message: string | null
          id: string
          manually_retried: boolean | null
          order_id: string
          order_line_id: string | null
          pharmacy_id: string
          pharmacy_order_id: string | null
          request_payload: Json
          response_body: Json | null
          response_status: number | null
          retried_at: string | null
          retried_by: string | null
          retry_count: number | null
          success: boolean | null
          transmission_type: string
          transmitted_at: string | null
        }
        Insert: {
          api_endpoint: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          manually_retried?: boolean | null
          order_id: string
          order_line_id?: string | null
          pharmacy_id: string
          pharmacy_order_id?: string | null
          request_payload: Json
          response_body?: Json | null
          response_status?: number | null
          retried_at?: string | null
          retried_by?: string | null
          retry_count?: number | null
          success?: boolean | null
          transmission_type: string
          transmitted_at?: string | null
        }
        Update: {
          api_endpoint?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          manually_retried?: boolean | null
          order_id?: string
          order_line_id?: string | null
          pharmacy_id?: string
          pharmacy_order_id?: string | null
          request_payload?: Json
          response_body?: Json | null
          response_status?: number | null
          retried_at?: string | null
          retried_by?: string | null
          retry_count?: number | null
          success?: boolean | null
          transmission_type?: string
          transmitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_order_transmissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_transmissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_transmissions_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_order_transmissions_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_shipping_rates: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          pharmacy_id: string
          rate: number
          shipping_speed: string
          vios_service_code: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          pharmacy_id: string
          rate: number
          shipping_speed: string
          vios_service_code?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          pharmacy_id?: string
          rate?: number
          shipping_speed?: string
          vios_service_code?: number | null
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
      pharmacy_staff: {
        Row: {
          active: boolean
          can_manage_orders: boolean
          can_manage_shipping: boolean
          can_view_api_config: boolean
          created_at: string
          id: string
          pharmacy_id: string
          role_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          can_manage_orders?: boolean
          can_manage_shipping?: boolean
          can_view_api_config?: boolean
          created_at?: string
          id?: string
          pharmacy_id: string
          role_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          can_manage_orders?: boolean
          can_manage_shipping?: boolean
          can_view_api_config?: boolean
          created_at?: string
          id?: string
          pharmacy_id?: string
          role_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_staff_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_tracking_updates: {
        Row: {
          actual_delivery_date: string | null
          carrier: string | null
          created_at: string | null
          estimated_delivery_date: string | null
          id: string
          location: string | null
          order_line_id: string
          pharmacy_id: string
          raw_tracking_data: Json | null
          received_at: string | null
          status: string
          status_details: string | null
          tracking_number: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          carrier?: string | null
          created_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          location?: string | null
          order_line_id: string
          pharmacy_id: string
          raw_tracking_data?: Json | null
          received_at?: string | null
          status: string
          status_details?: string | null
          tracking_number?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          carrier?: string | null
          created_at?: string | null
          estimated_delivery_date?: string | null
          id?: string
          location?: string | null
          order_line_id?: string
          pharmacy_id?: string
          raw_tracking_data?: Json | null
          received_at?: string | null
          status?: string
          status_details?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_tracking_updates_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_tracking_updates_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          is_duplicate: boolean | null
          order_line_id: string | null
          pharmacy_id: string
          processing_time_ms: number | null
          raw_payload: Json
          replayed_from_event_id: string | null
          request_headers: Json | null
          response_body: Json | null
          status_code: number
          transformed_payload: Json | null
          webhook_path: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_duplicate?: boolean | null
          order_line_id?: string | null
          pharmacy_id: string
          processing_time_ms?: number | null
          raw_payload: Json
          replayed_from_event_id?: string | null
          request_headers?: Json | null
          response_body?: Json | null
          status_code: number
          transformed_payload?: Json | null
          webhook_path?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_duplicate?: boolean | null
          order_line_id?: string | null
          pharmacy_id?: string
          processing_time_ms?: number | null
          raw_payload?: Json
          replayed_from_event_id?: string | null
          request_headers?: Json | null
          response_body?: Json | null
          status_code?: number
          transformed_payload?: Json | null
          webhook_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_webhook_events_order_line_id_fkey"
            columns: ["order_line_id"]
            isOneToOne: false
            referencedRelation: "order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_webhook_events_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_webhook_events_replayed_from_event_id_fkey"
            columns: ["replayed_from_event_id"]
            isOneToOne: false
            referencedRelation: "pharmacy_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_automation_settings: {
        Row: {
          created_at: string | null
          enable_email_notifications: boolean | null
          enable_sms_notifications: boolean | null
          id: string
          practice_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enable_email_notifications?: boolean | null
          enable_sms_notifications?: boolean | null
          id?: string
          practice_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enable_email_notifications?: boolean | null
          enable_sms_notifications?: boolean | null
          id?: string
          practice_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_automation_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_automation_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_blocked_time: {
        Row: {
          block_type: string
          blocked_by: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          practice_id: string
          provider_id: string | null
          reason: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          block_type: string
          blocked_by: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          practice_id: string
          provider_id?: string | null
          reason?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          blocked_by?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          practice_id?: string
          provider_id?: string | null
          reason?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_blocked_time_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_blocked_time_blocked_by_fkey"
            columns: ["blocked_by"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_blocked_time_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_blocked_time_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_blocked_time_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_calendar_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_closed: boolean
          practice_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_closed?: boolean
          practice_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_closed?: boolean
          practice_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_calendar_hours_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_calendar_hours_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_development_fee_invoices: {
        Row: {
          amount: number
          billing_month: string
          created_at: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          invoice_template_data: Json | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          pdf_url: string | null
          sent_at: string | null
          status: string
          topline_rep_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount: number
          billing_month: string
          created_at?: string
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          invoice_template_data?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          topline_rep_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount?: number
          billing_month?: string
          created_at?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_template_data?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          status?: string
          topline_rep_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_development_fee_invoices_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
          {
            foreignKeyName: "practice_development_fee_invoices_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_development_fees: {
        Row: {
          active: boolean
          created_at: string
          effective_from: string
          effective_until: string | null
          id: string
          monthly_amount: number
          notes: string | null
          practice_id: string
          topline_rep_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          effective_from: string
          effective_until?: string | null
          id?: string
          monthly_amount: number
          notes?: string | null
          practice_id: string
          topline_rep_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          monthly_amount?: number
          notes?: string | null
          practice_id?: string
          topline_rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_development_fees_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
          {
            foreignKeyName: "practice_development_fees_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
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
      practice_rooms: {
        Row: {
          active: boolean
          capacity: number
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          practice_id: string
        }
        Insert: {
          active?: boolean
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          practice_id: string
        }
        Update: {
          active?: boolean
          capacity?: number
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          practice_id?: string
        }
        Relationships: []
      }
      practice_staff: {
        Row: {
          active: boolean
          can_order: boolean
          created_at: string
          id: string
          practice_id: string
          role_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          can_order?: boolean
          created_at?: string
          id?: string
          practice_id: string
          role_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          can_order?: boolean
          created_at?: string
          id?: string
          practice_id?: string
          role_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_staff_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_subscriptions: {
        Row: {
          assigned_rep_id: string | null
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_ends_at: string | null
          id: string
          last_payment_attempt_at: string | null
          monthly_price: number | null
          paid_terms_accepted_at: string | null
          paid_terms_version: string | null
          practice_id: string
          rep_commission_percentage: number | null
          status: string
          trial_ends_at: string | null
          trial_start_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_rep_id?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_payment_attempt_at?: string | null
          monthly_price?: number | null
          paid_terms_accepted_at?: string | null
          paid_terms_version?: string | null
          practice_id: string
          rep_commission_percentage?: number | null
          status?: string
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_rep_id?: string | null
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          last_payment_attempt_at?: string | null
          monthly_price?: number | null
          paid_terms_accepted_at?: string | null
          paid_terms_version?: string | null
          practice_id?: string
          rep_commission_percentage?: number | null
          status?: string
          trial_ends_at?: string | null
          trial_start_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_subscriptions_assigned_rep_id_fkey"
            columns: ["assigned_rep_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
          {
            foreignKeyName: "practice_subscriptions_assigned_rep_id_fkey"
            columns: ["assigned_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_subscriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_video_rooms: {
        Row: {
          active_session_id: string | null
          channel_name: string
          created_at: string
          id: string
          practice_id: string
          room_key: string
          updated_at: string
        }
        Insert: {
          active_session_id?: string | null
          channel_name: string
          created_at?: string
          id?: string
          practice_id: string
          room_key: string
          updated_at?: string
        }
        Update: {
          active_session_id?: string | null
          channel_name?: string
          created_at?: string
          id?: string
          practice_id?: string
          room_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_video_rooms_active_session_id_fkey"
            columns: ["active_session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_video_rooms_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_video_rooms_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: true
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
      prescriptions: {
        Row: {
          created_at: string
          dosage: string | null
          id: string
          medication_name: string
          patient_account_id: string
          practice_id: string
          provider_id: string | null
          quantity: number | null
          refills_allowed: number | null
          sig: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_name: string
          patient_account_id: string
          practice_id: string
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: number | null
          sig?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          id?: string
          medication_name?: string
          patient_account_id?: string
          practice_id?: string
          provider_id?: string | null
          quantity?: number | null
          refills_allowed?: number | null
          sig?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "prescriptions_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "prescriptions_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "prescriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_cart_items: {
        Row: {
          created_at: string
          id: string
          practice_id: string | null
          pro_product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          practice_id?: string | null
          pro_product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          practice_id?: string | null
          pro_product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pro_cart_items_pro_product_id_fkey"
            columns: ["pro_product_id"]
            isOneToOne: false
            referencedRelation: "pro_products"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_orders: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          line_items: Json
          notes: string | null
          practice_id: string | null
          ship_to_address: Json | null
          shipping: number
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          notes?: string | null
          practice_id?: string | null
          ship_to_address?: Json | null
          shipping?: number
          subtotal?: number
          total?: number
          user_id: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          line_items?: Json
          notes?: string | null
          practice_id?: string | null
          ship_to_address?: Json | null
          shipping?: number
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      pro_products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pharmacies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
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
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          active: boolean | null
          created_at: string | null
          glp_clinical_statement: string | null
          id: string
          is_glp: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          glp_clinical_statement?: string | null
          id?: string
          is_glp?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          glp_clinical_statement?: string | null
          id?: string
          is_glp?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          active: boolean | null
          base_price: number
          created_at: string | null
          default_sig: string | null
          dosage_label: string
          downline_price: number | null
          id: string
          product_code: string | null
          product_id: string
          retail_price: number | null
          sku: string | null
          sort_order: number | null
          topline_price: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          base_price: number
          created_at?: string | null
          default_sig?: string | null
          dosage_label: string
          downline_price?: number | null
          id?: string
          product_code?: string | null
          product_id: string
          retail_price?: number | null
          sku?: string | null
          sort_order?: number | null
          topline_price?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          base_price?: number
          created_at?: string | null
          default_sig?: string | null
          dosage_label?: string
          downline_price?: number | null
          id?: string
          product_code?: string | null
          product_id?: string
          retail_price?: number | null
          sku?: string | null
          sort_order?: number | null
          topline_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          base_price: number
          created_at: string | null
          description: string | null
          dosage: string | null
          dosage_form: string | null
          downline_price: number | null
          glp1_clinical_statement: string | null
          id: string
          image_url: string | null
          is_glp1: boolean | null
          name: string
          pharmacy_id: string | null
          product_type_id: string
          requires_prescription: boolean
          retail_price: number | null
          schedule_code: string | null
          sig: string | null
          topline_price: number | null
          updated_at: string | null
          vios_lf_product_id: string | null
        }
        Insert: {
          active?: boolean | null
          base_price: number
          created_at?: string | null
          description?: string | null
          dosage?: string | null
          dosage_form?: string | null
          downline_price?: number | null
          glp1_clinical_statement?: string | null
          id?: string
          image_url?: string | null
          is_glp1?: boolean | null
          name: string
          pharmacy_id?: string | null
          product_type_id: string
          requires_prescription?: boolean
          retail_price?: number | null
          schedule_code?: string | null
          sig?: string | null
          topline_price?: number | null
          updated_at?: string | null
          vios_lf_product_id?: string | null
        }
        Update: {
          active?: boolean | null
          base_price?: number
          created_at?: string | null
          description?: string | null
          dosage?: string | null
          dosage_form?: string | null
          downline_price?: number | null
          glp1_clinical_statement?: string | null
          id?: string
          image_url?: string | null
          is_glp1?: boolean | null
          name?: string
          pharmacy_id?: string | null
          product_type_id?: string
          requires_prescription?: boolean
          retail_price?: number | null
          schedule_code?: string | null
          sig?: string | null
          topline_price?: number | null
          updated_at?: string | null
          vios_lf_product_id?: string | null
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
          address_suite: string | null
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
          has_prescriber: boolean
          has_seen_welcome_tour: boolean
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
          prescriber_name: string | null
          shipping_address: string | null
          shipping_address_city: string | null
          shipping_address_formatted: string | null
          shipping_address_state: string | null
          shipping_address_street: string | null
          shipping_address_suite: string | null
          shipping_address_verification_source: string | null
          shipping_address_verification_status: string | null
          shipping_address_verified_at: string | null
          shipping_address_zip: string | null
          shipping_preference: string | null
          signed_up_by_rep_id: string | null
          staff_role_type: string | null
          status: string | null
          temp_password: boolean | null
          updated_at: string | null
          verified_at: string | null
          vios_practice_id: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
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
          has_prescriber?: boolean
          has_seen_welcome_tour?: boolean
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
          prescriber_name?: string | null
          shipping_address?: string | null
          shipping_address_city?: string | null
          shipping_address_formatted?: string | null
          shipping_address_state?: string | null
          shipping_address_street?: string | null
          shipping_address_suite?: string | null
          shipping_address_verification_source?: string | null
          shipping_address_verification_status?: string | null
          shipping_address_verified_at?: string | null
          shipping_address_zip?: string | null
          shipping_preference?: string | null
          signed_up_by_rep_id?: string | null
          staff_role_type?: string | null
          status?: string | null
          temp_password?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
          vios_practice_id?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          address_city?: string | null
          address_encrypted?: string | null
          address_formatted?: string | null
          address_state?: string | null
          address_street?: string | null
          address_suite?: string | null
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
          has_prescriber?: boolean
          has_seen_welcome_tour?: boolean
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
          prescriber_name?: string | null
          shipping_address?: string | null
          shipping_address_city?: string | null
          shipping_address_formatted?: string | null
          shipping_address_state?: string | null
          shipping_address_street?: string | null
          shipping_address_suite?: string | null
          shipping_address_verification_source?: string | null
          shipping_address_verification_status?: string | null
          shipping_address_verified_at?: string | null
          shipping_address_zip?: string | null
          shipping_preference?: string | null
          signed_up_by_rep_id?: string | null
          staff_role_type?: string | null
          status?: string | null
          temp_password?: boolean | null
          updated_at?: string | null
          verified_at?: string | null
          vios_practice_id?: string | null
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
          {
            foreignKeyName: "profiles_signed_up_by_rep_id_fkey"
            columns: ["signed_up_by_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_signed_up_by_rep_id_fkey"
            columns: ["signed_up_by_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_document_assignments: {
        Row: {
          assigned_at: string | null
          created_at: string | null
          created_by: string | null
          document_id: string
          id: string
          patient_id: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id: string
          id?: string
          patient_id: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string | null
          created_by?: string | null
          document_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_document_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "provider_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "provider_document_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "provider_document_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      provider_document_patients: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          document_id: string
          id: string
          patient_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          document_id: string
          id?: string
          patient_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          document_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_document_patients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "provider_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "provider_document_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_document_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "provider_document_patients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      provider_documents: {
        Row: {
          assigned_patient_id: string | null
          created_at: string | null
          document_name: string
          document_type: string
          file_size: number | null
          id: string
          is_internal: boolean | null
          mime_type: string | null
          notes: string | null
          practice_id: string
          status: string | null
          storage_path: string
          storage_provider: string | null
          tags: string[] | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          assigned_patient_id?: string | null
          created_at?: string | null
          document_name: string
          document_type: string
          file_size?: number | null
          id?: string
          is_internal?: boolean | null
          mime_type?: string | null
          notes?: string | null
          practice_id: string
          status?: string | null
          storage_path: string
          storage_provider?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          assigned_patient_id?: string | null
          created_at?: string | null
          document_name?: string
          document_type?: string
          file_size?: number | null
          id?: string
          is_internal?: boolean | null
          mime_type?: string | null
          notes?: string | null
          practice_id?: string
          status?: string | null
          storage_path?: string
          storage_provider?: string | null
          tags?: string[] | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_documents_assigned_patient_id_fkey"
            columns: ["assigned_patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "provider_documents_assigned_patient_id_fkey"
            columns: ["assigned_patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_assigned_patient_id_fkey"
            columns: ["assigned_patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_assigned_patient_id_fkey"
            columns: ["assigned_patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "provider_documents_assigned_patient_id_fkey"
            columns: ["assigned_patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "provider_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_documents_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          active: boolean
          can_order: boolean
          created_at: string
          id: string
          practice_id: string
          role_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          can_order?: boolean
          created_at?: string
          id?: string
          practice_id: string
          role_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          can_order?: boolean
          created_at?: string
          id?: string
          practice_id?: string
          role_type?: string
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
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_payment_batches: {
        Row: {
          batch_number: string
          created_at: string
          date_range_end: string
          date_range_start: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string | null
          topline_rep_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          date_range_end: string
          date_range_start: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          topline_rep_id: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          topline_rep_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      rep_payments: {
        Row: {
          amount_paid: number
          batch_id: string | null
          created_at: string
          date_range_end: string
          date_range_start: string
          id: string
          notes: string | null
          payment_method: string | null
          profit_ids: string[]
          topline_rep_id: string
          updated_at: string
        }
        Insert: {
          amount_paid: number
          batch_id?: string | null
          created_at?: string
          date_range_end: string
          date_range_start: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          profit_ids: string[]
          topline_rep_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          batch_id?: string | null
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          profit_ids?: string[]
          topline_rep_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_product_price_overrides: {
        Row: {
          created_at: string
          created_by: string
          effective_from: string
          effective_until: string | null
          id: string
          notes: string | null
          override_downline_price: number | null
          override_price: number
          override_retail_price: number | null
          override_topline_price: number | null
          product_id: string
          rep_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          notes?: string | null
          override_downline_price?: number | null
          override_price: number
          override_retail_price?: number | null
          override_topline_price?: number | null
          product_id: string
          rep_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          notes?: string | null
          override_downline_price?: number | null
          override_price?: number
          override_retail_price?: number | null
          override_topline_price?: number | null
          product_id?: string
          rep_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_product_visibility: {
        Row: {
          created_at: string
          id: string
          product_id: string
          topline_rep_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          topline_rep_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          topline_rep_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rep_product_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_product_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "rep_product_visibility_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_product_visibility_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
          {
            foreignKeyName: "rep_product_visibility_topline_rep_id_fkey"
            columns: ["topline_rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_subscription_commissions: {
        Row: {
          billing_month: string
          commission_amount: number
          commission_type: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_status: string | null
          practice_subscription_id: string | null
          rep_id: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          billing_month: string
          commission_amount: number
          commission_type: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          practice_subscription_id?: string | null
          rep_id: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          billing_month?: string
          commission_amount?: number
          commission_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          practice_subscription_id?: string | null
          rep_id?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_subscription_commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_subscription_commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_subscription_commissions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "practice_subscriptions"
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
            referencedRelation: "rep_productivity_view"
            referencedColumns: ["rep_id"]
          },
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
      rls_audit_results: {
        Row: {
          checked_at: string | null
          details: string | null
          has_select_policy: boolean | null
          id: string
          policy_count: number | null
          rls_enabled: boolean | null
          table_name: string | null
        }
        Insert: {
          checked_at?: string | null
          details?: string | null
          has_select_policy?: boolean | null
          id?: string
          policy_count?: number | null
          rls_enabled?: boolean | null
          table_name?: string | null
        }
        Update: {
          checked_at?: string | null
          details?: string | null
          has_select_policy?: boolean | null
          id?: string
          policy_count?: number | null
          rls_enabled?: boolean | null
          table_name?: string | null
        }
        Relationships: []
      }
      security_audit_history: {
        Row: {
          audit_timestamp: string
          audited_by: string | null
          id: string
          notes: string | null
          report_data: Json
        }
        Insert: {
          audit_timestamp?: string
          audited_by?: string | null
          id?: string
          notes?: string | null
          report_data: Json
        }
        Update: {
          audit_timestamp?: string
          audited_by?: string | null
          id?: string
          notes?: string | null
          report_data?: Json
        }
        Relationships: []
      }
      sms_codes: {
        Row: {
          attempt_count: number | null
          code: string
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
          attempt_id: string
          code_hash: string
          created_at: string
          expires_at: string
          user_id: string
          verified_at: string | null
          window_key: string
        }
        Insert: {
          attempt_id?: string
          code_hash: string
          created_at?: string
          expires_at: string
          user_id: string
          verified_at?: string | null
          window_key: string
        }
        Update: {
          attempt_id?: string
          code_hash?: string
          created_at?: string
          expires_at?: string
          user_id?: string
          verified_at?: string | null
          window_key?: string
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
      subscription_payments: {
        Row: {
          amount: number
          billing_month: string
          created_at: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string | null
          practice_id: string
          subscription_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          billing_month: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          practice_id: string
          subscription_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_month?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          practice_id?: string
          subscription_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          created_at: string
          id: string
          is_internal_note: boolean | null
          message: string
          replied_by: string
          replied_by_email: string
          replied_by_name: string | null
          replied_by_role: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message: string
          replied_by: string
          replied_by_email: string
          replied_by_name?: string | null
          replied_by_role: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal_note?: boolean | null
          message?: string
          replied_by?: string
          replied_by_email?: string
          replied_by_name?: string | null
          replied_by_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          created_by: string
          created_by_email: string
          created_by_name: string | null
          created_by_role: string
          description: string
          id: string
          last_reply_at: string | null
          order_id: string | null
          order_line_id: string | null
          patient_id: string | null
          pharmacy_id: string | null
          practice_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by: string
          created_by_email: string
          created_by_name?: string | null
          created_by_role: string
          description: string
          id?: string
          last_reply_at?: string | null
          order_id?: string | null
          order_line_id?: string | null
          patient_id?: string | null
          pharmacy_id?: string | null
          practice_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          created_by_email?: string
          created_by_name?: string | null
          created_by_role?: string
          description?: string
          id?: string
          last_reply_at?: string | null
          order_id?: string | null
          order_line_id?: string | null
          patient_id?: string | null
          pharmacy_id?: string | null
          practice_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: string
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          practice_id: string | null
          setting_key: string
          setting_type: string | null
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          practice_id?: string | null
          setting_key: string
          setting_type?: string | null
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          practice_id?: string | null
          setting_key?: string
          setting_type?: string | null
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_password_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          used_at?: string | null
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
      treatment_plan_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["plan_attachment_type"]
          description: string | null
          file_name: string
          file_size: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          storage_path: string
          taken_date: string | null
          treatment_plan_id: string
          uploaded_at: string
          uploaded_by_name: string
          uploaded_by_user_id: string
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["plan_attachment_type"]
          description?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path: string
          taken_date?: string | null
          treatment_plan_id: string
          uploaded_at?: string
          uploaded_by_name: string
          uploaded_by_user_id: string
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["plan_attachment_type"]
          description?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          storage_path?: string
          taken_date?: string | null
          treatment_plan_id?: string
          uploaded_at?: string
          uploaded_by_name?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_attachments_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_goals: {
        Row: {
          achievement_notes: string | null
          created_at: string
          created_by_name: string
          created_by_user_id: string
          date_achieved: string | null
          date_modified: string | null
          goal_description: string
          goal_order: number
          id: string
          is_achievable: boolean
          is_active: boolean
          is_measurable: boolean
          is_relevant: boolean
          is_specific: boolean
          is_time_bound: boolean
          last_updated_by_name: string | null
          last_updated_by_user_id: string | null
          modification_reason: string | null
          previous_description: string | null
          status: Database["public"]["Enums"]["treatment_goal_status"]
          treatment_plan_id: string
          updated_at: string
        }
        Insert: {
          achievement_notes?: string | null
          created_at?: string
          created_by_name: string
          created_by_user_id: string
          date_achieved?: string | null
          date_modified?: string | null
          goal_description: string
          goal_order?: number
          id?: string
          is_achievable?: boolean
          is_active?: boolean
          is_measurable?: boolean
          is_relevant?: boolean
          is_specific?: boolean
          is_time_bound?: boolean
          last_updated_by_name?: string | null
          last_updated_by_user_id?: string | null
          modification_reason?: string | null
          previous_description?: string | null
          status?: Database["public"]["Enums"]["treatment_goal_status"]
          treatment_plan_id: string
          updated_at?: string
        }
        Update: {
          achievement_notes?: string | null
          created_at?: string
          created_by_name?: string
          created_by_user_id?: string
          date_achieved?: string | null
          date_modified?: string | null
          goal_description?: string
          goal_order?: number
          id?: string
          is_achievable?: boolean
          is_active?: boolean
          is_measurable?: boolean
          is_relevant?: boolean
          is_specific?: boolean
          is_time_bound?: boolean
          last_updated_by_name?: string | null
          last_updated_by_user_id?: string | null
          modification_reason?: string | null
          previous_description?: string | null
          status?: Database["public"]["Enums"]["treatment_goal_status"]
          treatment_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_goals_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_updates: {
        Row: {
          created_at: string
          created_by_name: string
          created_by_role: string
          created_by_user_id: string
          id: string
          new_status: string | null
          previous_status: string | null
          related_appointment_id: string | null
          treatment_plan_id: string
          update_content: string
          update_type: Database["public"]["Enums"]["treatment_update_type"]
        }
        Insert: {
          created_at?: string
          created_by_name: string
          created_by_role: string
          created_by_user_id: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          related_appointment_id?: string | null
          treatment_plan_id: string
          update_content: string
          update_type: Database["public"]["Enums"]["treatment_update_type"]
        }
        Update: {
          created_at?: string
          created_by_name?: string
          created_by_role?: string
          created_by_user_id?: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          related_appointment_id?: string | null
          treatment_plan_id?: string
          update_content?: string
          update_type?: Database["public"]["Enums"]["treatment_update_type"]
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_updates_treatment_plan_id_fkey"
            columns: ["treatment_plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plans: {
        Row: {
          actual_completion_date: string | null
          created_at: string
          created_by_name: string
          created_by_role: string
          created_by_user_id: string
          diagnosis_condition: string | null
          id: string
          is_active: boolean
          is_locked: boolean
          last_updated_by_name: string | null
          last_updated_by_user_id: string | null
          locked_at: string | null
          locked_by_name: string | null
          locked_by_user_id: string | null
          notes: string | null
          patient_account_id: string
          plan_title: string
          responsible_provider_id: string | null
          responsible_provider_name: string | null
          status: Database["public"]["Enums"]["treatment_plan_status"]
          target_completion_date: string | null
          treatment_protocols: string
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          created_at?: string
          created_by_name: string
          created_by_role: string
          created_by_user_id: string
          diagnosis_condition?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          last_updated_by_name?: string | null
          last_updated_by_user_id?: string | null
          locked_at?: string | null
          locked_by_name?: string | null
          locked_by_user_id?: string | null
          notes?: string | null
          patient_account_id: string
          plan_title: string
          responsible_provider_id?: string | null
          responsible_provider_name?: string | null
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          target_completion_date?: string | null
          treatment_protocols: string
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          created_at?: string
          created_by_name?: string
          created_by_role?: string
          created_by_user_id?: string
          diagnosis_condition?: string | null
          id?: string
          is_active?: boolean
          is_locked?: boolean
          last_updated_by_name?: string | null
          last_updated_by_user_id?: string | null
          locked_at?: string | null
          locked_by_name?: string | null
          locked_by_user_id?: string | null
          notes?: string | null
          patient_account_id?: string
          plan_title?: string
          responsible_provider_id?: string | null
          responsible_provider_name?: string | null
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          target_completion_date?: string | null
          treatment_protocols?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "treatment_plans_patient_account_id_fkey"
            columns: ["patient_account_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      two_fa_audit_log: {
        Row: {
          action: string
          attempt_count: number | null
          code_verified: boolean | null
          created_at: string
          details: Json | null
          event_type: string | null
          id: string
          ip_address: string | null
          phone: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          attempt_count?: number | null
          code_verified?: boolean | null
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          success: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          attempt_count?: number | null
          code_verified?: boolean | null
          created_at?: string
          details?: Json | null
          event_type?: string | null
          id?: string
          ip_address?: string | null
          phone?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
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
          last_twilio_verification: string | null
          last_verified_at: string | null
          phone_number: string | null
          phone_number_encrypted: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          reset_at: string | null
          reset_requested_by: string | null
          twilio_enabled: boolean | null
          twilio_phone_verified: boolean | null
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
          last_twilio_verification?: string | null
          last_verified_at?: string | null
          phone_number?: string | null
          phone_number_encrypted?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_verified?: boolean | null
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
          last_twilio_verification?: string | null
          last_verified_at?: string | null
          phone_number?: string | null
          phone_number_encrypted?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_verified?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_password_status: {
        Row: {
          created_at: string
          id: string
          must_change_password: boolean
          password_changed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          must_change_password?: boolean
          password_changed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          must_change_password?: boolean
          password_changed_at?: string | null
          updated_at?: string
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
          impersonated_user_id: string | null
          session_created_at: string | null
          session_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          csrf_token: string
          expires_at: string
          id?: string
          impersonated_user_id?: string | null
          session_created_at?: string | null
          session_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          csrf_token?: string
          expires_at?: string
          id?: string
          impersonated_user_id?: string | null
          session_created_at?: string | null
          session_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_terms_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          ip_address: string | null
          pdf_url: string | null
          role: Database["public"]["Enums"]["app_role"]
          terms_id: string | null
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          role: Database["public"]["Enums"]["app_role"]
          terms_id?: string | null
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          terms_id?: string | null
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      video_guest_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          guest_email: string | null
          guest_name: string | null
          id: string
          session_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          session_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          session_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_guest_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_session_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          session_id: string
          user_uid: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          session_id: string
          user_uid: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          session_id?: string
          user_uid?: string
        }
        Relationships: []
      }
      video_session_guest_links: {
        Row: {
          access_count: number | null
          accessed_by_ip: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          is_revoked: boolean | null
          max_uses: number | null
          session_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          access_count?: number | null
          accessed_by_ip?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          is_revoked?: boolean | null
          max_uses?: number | null
          session_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          access_count?: number | null
          accessed_by_ip?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          is_revoked?: boolean | null
          max_uses?: number | null
          session_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_session_guest_links_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_session_logs: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          session_id: string
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          session_id: string
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_session_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "video_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sessions: {
        Row: {
          actual_start_time: string | null
          agora_channel_id: string | null
          appointment_id: string | null
          channel_name: string
          connection_quality: Json | null
          created_at: string | null
          created_by_user_id: string | null
          duration_seconds: number | null
          end_time: string | null
          id: string
          metadata: Json | null
          patient_id: string
          patient_joined_at: string | null
          patient_left_at: string | null
          practice_id: string
          provider_id: string | null
          provider_joined_at: string | null
          provider_left_at: string | null
          recording_enabled: boolean | null
          recording_expires_at: string | null
          recording_file_size_bytes: number | null
          recording_resource_id: string | null
          recording_sid: string | null
          recording_started_at: string | null
          recording_stopped_at: string | null
          recording_storage_cost: number | null
          recording_url: string | null
          scheduled_start_time: string
          session_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_start_time?: string | null
          agora_channel_id?: string | null
          appointment_id?: string | null
          channel_name: string
          connection_quality?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          patient_id: string
          patient_joined_at?: string | null
          patient_left_at?: string | null
          practice_id: string
          provider_id?: string | null
          provider_joined_at?: string | null
          provider_left_at?: string | null
          recording_enabled?: boolean | null
          recording_expires_at?: string | null
          recording_file_size_bytes?: number | null
          recording_resource_id?: string | null
          recording_sid?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_storage_cost?: number | null
          recording_url?: string | null
          scheduled_start_time: string
          session_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_start_time?: string | null
          agora_channel_id?: string | null
          appointment_id?: string | null
          channel_name?: string
          connection_quality?: Json | null
          created_at?: string | null
          created_by_user_id?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          patient_id?: string
          patient_joined_at?: string | null
          patient_left_at?: string | null
          practice_id?: string
          provider_id?: string | null
          provider_joined_at?: string | null
          provider_left_at?: string | null
          recording_enabled?: boolean | null
          recording_expires_at?: string | null
          recording_file_size_bytes?: number | null
          recording_resource_id?: string | null
          recording_sid?: string | null
          recording_started_at?: string | null
          recording_stopped_at?: string | null
          recording_storage_cost?: number | null
          recording_url?: string | null
          scheduled_start_time?: string
          session_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "patient_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "video_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "video_sessions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      video_usage_pricing: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_from: string
          id: string
          included_minutes_per_month: number | null
          notes: string | null
          rate_per_minute: number
          storage_rate_per_gb_per_month: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          included_minutes_per_month?: number | null
          notes?: string | null
          rate_per_minute?: number
          storage_rate_per_gb_per_month?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          included_minutes_per_month?: number | null
          notes?: string | null
          rate_per_minute?: number
          storage_rate_per_gb_per_month?: number | null
        }
        Relationships: []
      }
      vios_allergies: {
        Row: {
          alternate_names: string[] | null
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
          vios_code: number
        }
        Insert: {
          alternate_names?: string[] | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          vios_code: number
        }
        Update: {
          alternate_names?: string[] | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          vios_code?: number
        }
        Relationships: []
      }
      vios_product_catalog: {
        Row: {
          created_at: string | null
          form: string | null
          id: string
          med_id: string
          package: string | null
          product_name: string
          schedule: string | null
          strength: string | null
          units: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          form?: string | null
          id?: string
          med_id: string
          package?: string | null
          product_name: string
          schedule?: string | null
          strength?: string | null
          units?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          form?: string | null
          id?: string
          med_id?: string
          package?: string | null
          product_name?: string
          schedule?: string | null
          strength?: string | null
          units?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
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
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "cart_lines_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_variant_stats"
            referencedColumns: ["product_id"]
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
      mv_top_products: {
        Row: {
          avg_price: number | null
          id: string | null
          name: string | null
          total_revenue: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      patient_account_health: {
        Row: {
          account_status: string | null
          created_at: string | null
          email: string | null
          invitation_sent_at: string | null
          link_status: string | null
          name: string | null
          patient_id: string | null
          practice_id: string | null
          practice_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      penetration_test_summary: {
        Row: {
          failed_tests: number | null
          pass_rate: number | null
          passed_tests: number | null
          test_category: string | null
          total_tests: number | null
        }
        Relationships: []
      }
      product_variant_stats: {
        Row: {
          first_variant_dosage: string | null
          max_base_price: number | null
          max_downline_price: number | null
          max_retail_price: number | null
          max_topline_price: number | null
          min_base_price: number | null
          min_downline_price: number | null
          min_retail_price: number | null
          min_topline_price: number | null
          product_id: string | null
          variant_count: number | null
        }
        Relationships: []
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
      rep_productivity_view: {
        Row: {
          avg_order_value: number | null
          downline_count: number | null
          non_rx_orders: number | null
          practice_count: number | null
          rep_email: string | null
          rep_id: string | null
          rep_name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          rx_orders: number | null
          total_commissions: number | null
          total_orders: number | null
          total_revenue: number | null
          user_id: string | null
        }
        Relationships: [
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
      rls_audit_latest: {
        Row: {
          checked_at: string | null
          details: string | null
          has_select_policy: boolean | null
          policy_count: number | null
          rls_enabled: boolean | null
          table_name: string | null
        }
        Insert: {
          checked_at?: string | null
          details?: string | null
          has_select_policy?: boolean | null
          policy_count?: number | null
          rls_enabled?: boolean | null
          table_name?: string | null
        }
        Update: {
          checked_at?: string | null
          details?: string | null
          has_select_policy?: boolean | null
          policy_count?: number | null
          rls_enabled?: boolean | null
          table_name?: string | null
        }
        Relationships: []
      }
      rls_policy_coverage: {
        Row: {
          has_select_policy: boolean | null
          policy_count: number | null
          rls_enabled: boolean | null
          status: string | null
          tablename: unknown
        }
        Relationships: []
      }
      rls_policy_export: {
        Row: {
          cmd: string | null
          permissive: string | null
          policyname: unknown
          qual: string | null
          roles: unknown[] | null
          schemaname: unknown
          tablename: unknown
          with_check: string | null
        }
        Relationships: []
      }
      rls_policy_matrix: {
        Row: {
          policies: Json | null
          policy_count: number | null
          tablename: unknown
        }
        Relationships: []
      }
      security_audit_public_grants: {
        Row: {
          compliance: string | null
          grantee: unknown
          privilege_type: string | null
          table_name: unknown
          table_schema: unknown
        }
        Relationships: []
      }
      security_audit_rls_status: {
        Row: {
          compliance: string | null
          rls_status: string | null
          schemaname: unknown
          tablename: unknown
        }
        Relationships: []
      }
      security_audit_storage_buckets: {
        Row: {
          access_level: string | null
          allowed_mime_types: string[] | null
          compliance: string | null
          file_size_limit: number | null
          id: string | null
          name: string | null
        }
        Insert: {
          access_level?: never
          allowed_mime_types?: string[] | null
          compliance?: never
          file_size_limit?: number | null
          id?: string | null
          name?: string | null
        }
        Update: {
          access_level?: never
          allowed_mime_types?: string[] | null
          compliance?: never
          file_size_limit?: number | null
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      user_2fa_settings_decrypted: {
        Row: {
          created_at: string | null
          enrolled_at: string | null
          ghl_enabled: boolean | null
          ghl_phone_verified: boolean | null
          id: string | null
          is_enrolled: boolean | null
          last_ghl_verification: string | null
          last_twilio_verification: string | null
          last_verified_at: string | null
          phone_number: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          reset_at: string | null
          reset_requested_by: string | null
          twilio_enabled: boolean | null
          twilio_phone_verified: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrolled_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string | null
          is_enrolled?: boolean | null
          last_ghl_verification?: string | null
          last_twilio_verification?: string | null
          last_verified_at?: string | null
          phone_number?: never
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrolled_at?: string | null
          ghl_enabled?: boolean | null
          ghl_phone_verified?: boolean | null
          id?: string | null
          is_enrolled?: boolean | null
          last_ghl_verification?: string | null
          last_twilio_verification?: string | null
          last_verified_at?: string | null
          phone_number?: never
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          reset_at?: string | null
          reset_requested_by?: string | null
          twilio_enabled?: boolean | null
          twilio_phone_verified?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_order_summary: {
        Row: {
          created_at: string | null
          doctor_id: string | null
          id: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string | null
          payment_status: string | null
          practice_id: string | null
          status: string | null
          total_amount: number | null
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
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_account_health"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_account_id"]
          },
          {
            foreignKeyName: "orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "v_patients_with_portal_status"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "orders_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      v_patients_with_portal_status: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_verification_source: string | null
          address_verification_status: string | null
          address_zip: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          has_portal_access: boolean | null
          has_portal_account: boolean | null
          id: string | null
          last_login_at: string | null
          last_name: string | null
          name: string | null
          patient_account_id: string | null
          patient_id: string | null
          phone: string | null
          portal_status: string | null
          practice_id: string | null
          provider_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_accounts_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "profiles_masked_for_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      video_usage_by_practice: {
        Row: {
          billing_month: string | null
          first_session_date: string | null
          last_session_date: string | null
          practice_email: string | null
          practice_id: string | null
          practice_name: string | null
          sessions_with_recordings: number | null
          total_minutes: number | null
          total_seconds: number | null
          total_sessions: number | null
          unique_patients_served: number | null
          unique_providers_used: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_all_logs: { Args: never; Returns: Json }
      archive_old_audit_logs: { Args: never; Returns: number }
      auto_populate_order_profits: { Args: never; Returns: undefined }
      calculate_practice_video_bill: {
        Args: {
          p_end_date: string
          p_practice_id: string
          p_start_date: string
        }
        Returns: {
          billable_minutes: number
          included_minutes: number
          minute_rate: number
          minutes_cost: number
          storage_cost: number
          storage_gb: number
          total_cost: number
          total_minutes: number
        }[]
      }
      can_access_practice_messages: {
        Args: { _actor: string; _practice_id: string }
        Returns: boolean
      }
      can_access_practice_orders: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      can_act_for_practice: {
        Args: { p_practice_id: string }
        Returns: boolean
      }
      can_cancel_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      can_create_admin: { Args: { _inviter_id: string }; Returns: boolean }
      can_downline_view_practice: {
        Args: { _downline_user_id: string; _practice_id: string }
        Returns: boolean
      }
      can_manage_video_session: {
        Args: { _session_id: string; _user_id: string }
        Returns: boolean
      }
      can_order_for_practice: {
        Args: { _practice_id: string; _user_id: string }
        Returns: boolean
      }
      can_topline_view_practice: {
        Args: { _practice_id: string; _topline_user_id: string }
        Returns: boolean
      }
      can_user_impersonate: { Args: { _user_id: string }; Returns: boolean }
      can_view_credentials: { Args: { _user_id: string }; Returns: boolean }
      can_view_provider_profile: {
        Args: { _profile_id: string; _viewer_id: string }
        Returns: boolean
      }
      check_refill_eligibility: {
        Args: { p_order_line_id: string }
        Returns: Json
      }
      check_rls_integrity: { Args: never; Returns: undefined }
      cleanup_expired_cart_lines: { Args: never; Returns: number }
      cleanup_expired_csrf_tokens: { Args: never; Returns: number }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_expired_impersonation_sessions: { Args: never; Returns: number }
      cleanup_expired_reset_tokens: { Args: never; Returns: undefined }
      cleanup_expired_sms_attempts: { Args: never; Returns: undefined }
      cleanup_expired_sms_codes: { Args: never; Returns: undefined }
      count_doctor_orders: {
        Args: { p_doctor_id: string; p_since?: string }
        Returns: number
      }
      count_pharmacy_orders: {
        Args: { p_pharmacy_id: string }
        Returns: number
      }
      count_provider_orders: {
        Args: { p_provider_id: string }
        Returns: number
      }
      create_practice_subscription: {
        Args: { p_practice_id: string; p_start_trial?: boolean }
        Returns: string
      }
      create_user_with_role: {
        Args: {
          p_created_by?: string
          p_email: string
          p_full_name?: string
          p_name: string
          p_prescriber_name?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_role_data?: Json
          p_status?: string
          p_temp_password?: boolean
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
      decrypt_order_line_contact_service: {
        Args: { p_order_line_id: string }
        Returns: {
          patient_address: string
          patient_email: string
          patient_phone: string
        }[]
      }
      decrypt_pharmacy_credential: {
        Args: { p_encrypted_text: string }
        Returns: string
      }
      decrypt_pharmacy_credentials_batch: {
        Args: { p_pharmacy_id: string }
        Returns: {
          credential_key: string
          credential_type: string
          id: string
          pharmacy_id: string
        }[]
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
      disable_auth_user: { Args: { p_user_id: string }; Returns: undefined }
      encrypt_pharmacy_credential: {
        Args: { p_plain_text: string }
        Returns: string
      }
      encrypt_plaid_token: { Args: { p_token: string }; Returns: string }
      fix_orphaned_patient_accounts: {
        Args: never
        Returns: {
          action_taken: string
          auth_user_id: string
          fixed_at: string
          patient_email: string
          patient_id: string
        }[]
      }
      generate_guest_token: { Args: never; Returns: string }
      generate_room_key: { Args: never; Returns: string }
      generate_security_audit_report: { Args: never; Returns: Json }
      generate_ticket_number: { Args: never; Returns: string }
      get_appointments_during_blocked_time: {
        Args: {
          p_end_time: string
          p_practice_id: string
          p_provider_id: string
          p_start_time: string
        }
        Returns: {
          appointment_id: string
          end_time: string
          patient_name: string
          provider_name: string
          start_time: string
        }[]
      }
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
      get_decrypted_profile_credentials: {
        Args: { p_user_id: string }
        Returns: {
          dea: string
          full_name: string
          license_number: string
          npi: string
          phone: string
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
      get_default_notification_settings: {
        Args: { user_role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          email_enabled: boolean
          in_app_enabled: boolean
          sms_enabled: boolean
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
      get_downline_practice_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_effective_prices_bulk: {
        Args: { p_product_ids: string[]; p_user_id: string }
        Returns: {
          base_price: number
          effective_downline_price: number
          effective_retail_price: number
          effective_topline_price: number
          has_override: boolean
          product_id: string
        }[]
      }
      get_effective_product_price: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: {
          base_price: number
          effective_downline_price: number
          effective_retail_price: number
          effective_topline_price: number
          has_override: boolean
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
      get_order_lines_by_pharmacy: {
        Args: { from_date: string; limit_count?: number; pharmacy_uuid: string }
        Returns: {
          created_at: string
          order_id: string
        }[]
      }
      get_order_lines_by_provider: {
        Args: { from_date: string; limit_count?: number; provider_uuid: string }
        Returns: {
          created_at: string
          order_id: string
        }[]
      }
      get_order_lines_for_rep: {
        Args: {
          from_date: string
          limit_count?: number
          practice_ids: string[]
        }
        Returns: {
          created_at: string
          order_id: string
        }[]
      }
      get_orders_by_practice: {
        Args: { from_date: string; limit_count?: number; practice_uuid: string }
        Returns: {
          created_at: string
          id: string
        }[]
      }
      get_patient_appointments_with_details: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_patient_provider_documents: {
        Args: { p_patient_id: string }
        Returns: {
          assigned_patient_id: string
          created_at: string
          document_name: string
          document_type: string
          file_size: number
          id: string
          is_internal: boolean
          mime_type: string
          notes: string
          practice_id: string
          reviewed_at: string
          reviewed_by: string
          status: string
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string
        }[]
      }
      get_patient_unified_documents: {
        Args: { p_patient_id: string }
        Returns: {
          document_name: string
          document_type: string
          file_size: number
          id: string
          is_hidden: boolean
          notes: string
          patient_id: string
          practice_id: string
          share_with_practice: boolean
          source: string
          storage_path: string
          uploaded_at: string
          uploader_id: string
          uploader_name: string
          uploader_role: string
        }[]
      }
      get_patient_unread_message_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_patient_vault_counts: {
        Args: { p_patient_account_id: string }
        Returns: Json
      }
      get_patient_vault_grouped: {
        Args: { p_patient_account_id: string }
        Returns: Json
      }
      get_practice_assignable_users: {
        Args: { p_practice_id: string }
        Returns: {
          id: string
          name: string
          role: string
          role_display: string
          staff_role_type: string
        }[]
      }
      get_practice_hours_with_defaults: {
        Args: { p_day_of_week: number; p_practice_id: string }
        Returns: {
          end_time: string
          is_closed: boolean
          start_time: string
        }[]
      }
      get_practice_patients: {
        Args: { p_practice_id: string }
        Returns: {
          address: string
          address_city: string
          address_formatted: string
          address_state: string
          address_street: string
          address_suite: string
          address_verification_source: string
          address_verification_status: string
          address_zip: string
          allergies: string
          birth_date: string
          city: string
          created_at: string
          date_of_birth: string
          email: string
          first_name: string
          gender_at_birth: string
          id: string
          last_login_at: string
          last_name: string
          name: string
          notes: string
          phone: string
          practice_city: string
          practice_id: string
          practice_name: string
          practice_state: string
          provider_id: string
          state: string
          status: string
          user_id: string
          zip_code: string
        }[]
      }
      get_practice_team_members: {
        Args: { p_practice_id: string }
        Returns: {
          name: string
          role_display: string
          role_type: string
          user_id: string
        }[]
      }
      get_primary_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_provider_documents: {
        Args: { p_practice_id: string }
        Returns: {
          assigned_patient_ids: string[]
          assigned_patient_names: string[]
          document_name: string
          document_type: string
          file_size: number
          id: string
          mime_type: string
          notes: string
          source_type: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }[]
      }
      get_rep_earnings: {
        Args: { _rep_id: string }
        Returns: {
          amount: number
          created_at: string
          description: string
          doctor_id: string
          earning_type: string
          id: string
          invoice_number: string
          is_rx_required: boolean
          order_status: string
          paid_at: string
          payment_method: string
          payment_notes: string
          payment_status: string
          pdf_url: string
          practice_name: string
          reference_number: string
          related_id: string
          rep_id: string
        }[]
      }
      get_security_events_summary: {
        Args: never
        Returns: {
          action_type: string
          event_count: number
          last_occurrence: string
          unique_users: number
        }[]
      }
      get_topline_practice_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_topline_rep_id_for_practice: {
        Args: { _practice_linked_topline_user_id: string }
        Returns: string
      }
      get_unread_message_count: { Args: { p_user_id: string }; Returns: number }
      get_unread_notification_count: { Args: never; Returns: number }
      get_user_rep_id: { Args: { _user_id: string }; Returns: string }
      get_visible_pharmacies_for_effective_user: {
        Args: { p_effective_user_id: string }
        Returns: {
          id: string
        }[]
      }
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
      insert_medical_vault_audit_log: {
        Args: {
          p_action_type: string
          p_change_summary?: string
          p_changed_by?: string
          p_new_values?: Json
          p_patient_account_id: string
          p_performed_by_user_id?: string
          p_practice_id: string
          p_previous_values?: Json
          p_record_id?: string
        }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_admin_ip_banned: { Args: never; Returns: boolean }
      is_cart_owner: {
        Args: { _cart_id: string; _user_id: string }
        Returns: boolean
      }
      is_downline_of_topline: {
        Args: { _topline_user_id: string }
        Returns: boolean
      }
      is_downline_rep: { Args: { _user_id: string }; Returns: boolean }
      is_pharmacy_member: {
        Args: { _pharmacy_id: string; _user_id: string }
        Returns: boolean
      }
      is_pharmacy_owner: {
        Args: { _pharmacy_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_thread_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_topline_of_rep: { Args: { _rep_id: string }; Returns: boolean }
      is_topline_rep: { Args: { _user_id: string }; Returns: boolean }
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
      notify_due_follow_ups: { Args: never; Returns: undefined }
      patient_can_view_provider_document: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      pharmacy_can_view_order: {
        Args: { order_uuid: string; pharmacy_user_id: string }
        Returns: boolean
      }
      pharmacy_staff_access: {
        Args: { pharmacy_uuid: string }
        Returns: boolean
      }
      provider_can_view_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      recompute_order_profits:
        | {
            Args: { p_order_ids?: string[]; p_status_filter?: string[] }
            Returns: Json
          }
        | { Args: { p_status_filter?: string[] }; Returns: Json }
      refresh_rep_productivity_summary: { Args: never; Returns: undefined }
      refresh_rls_policy_export: { Args: never; Returns: undefined }
      refresh_security_events_summary: { Args: never; Returns: undefined }
      refresh_top_products: { Args: never; Returns: undefined }
      refresh_video_usage_by_practice: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_practice_address_to_providers: {
        Args: { p_practice_id: string }
        Returns: undefined
      }
      user_belongs_to_patient_practice: {
        Args: { _patient_account_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_practice_documents: {
        Args: { p_practice_id: string }
        Returns: boolean
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
        | "subscription"
        | "staff"
        | "patient"
        | "super_admin"
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
        | "product_request_approved"
        | "product_request_rejected"
        | "follow_up_due_today"
        | "follow_up_overdue"
        | "follow_up_upcoming"
        | "follow_up_assigned"
        | "practice_message_received"
        | "appointment_confirmed"
        | "appointment_rescheduled"
        | "appointment_cancelled"
        | "document_assigned"
        | "new_signup"
        | "system_error"
        | "support_message"
        | "security_alert"
        | "admin_action_required"
        | "order_placed"
        | "order_update"
        | "appointment_booked"
        | "appointment_reminder"
        | "appointment_update"
        | "subscription_reminder"
        | "subscription_activated"
        | "subscription_suspended"
        | "subscription_renewed"
        | "subscription_alert"
        | "payment_received"
        | "payment_failed"
        | "document_uploaded_by_patient"
        | "patient_message_received"
        | "new_patient_message"
        | "message_received"
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
      plan_attachment_type:
        | "before_photo"
        | "after_photo"
        | "progress_photo"
        | "consent_form"
        | "treatment_protocol"
        | "lab_result"
        | "other_document"
      shipping_carrier: "fedex" | "ups" | "usps" | "amazon"
      shipping_speed:
        | "ground"
        | "2day"
        | "overnight"
        | "priority"
        | "first_class"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_response"
        | "resolved"
        | "closed"
      ticket_type:
        | "pharmacy_order_issue"
        | "practice_to_admin"
        | "rep_to_admin"
        | "pharmacy_to_admin"
        | "pharmacy_to_practice"
      treatment_goal_status: "ongoing" | "achieved" | "modified" | "abandoned"
      treatment_plan_status:
        | "planned"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      treatment_update_type:
        | "progress_note"
        | "status_change"
        | "goal_update"
        | "treatment_completed"
        | "complication"
        | "patient_feedback"
        | "provider_note"
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
        "subscription",
        "staff",
        "patient",
        "super_admin",
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
        "product_request_approved",
        "product_request_rejected",
        "follow_up_due_today",
        "follow_up_overdue",
        "follow_up_upcoming",
        "follow_up_assigned",
        "practice_message_received",
        "appointment_confirmed",
        "appointment_rescheduled",
        "appointment_cancelled",
        "document_assigned",
        "new_signup",
        "system_error",
        "support_message",
        "security_alert",
        "admin_action_required",
        "order_placed",
        "order_update",
        "appointment_booked",
        "appointment_reminder",
        "appointment_update",
        "subscription_reminder",
        "subscription_activated",
        "subscription_suspended",
        "subscription_renewed",
        "subscription_alert",
        "payment_received",
        "payment_failed",
        "document_uploaded_by_patient",
        "patient_message_received",
        "new_patient_message",
        "message_received",
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
      plan_attachment_type: [
        "before_photo",
        "after_photo",
        "progress_photo",
        "consent_form",
        "treatment_protocol",
        "lab_result",
        "other_document",
      ],
      shipping_carrier: ["fedex", "ups", "usps", "amazon"],
      shipping_speed: [
        "ground",
        "2day",
        "overnight",
        "priority",
        "first_class",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_response",
        "resolved",
        "closed",
      ],
      ticket_type: [
        "pharmacy_order_issue",
        "practice_to_admin",
        "rep_to_admin",
        "pharmacy_to_admin",
        "pharmacy_to_practice",
      ],
      treatment_goal_status: ["ongoing", "achieved", "modified", "abandoned"],
      treatment_plan_status: [
        "planned",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      treatment_update_type: [
        "progress_note",
        "status_change",
        "goal_update",
        "treatment_completed",
        "complication",
        "patient_feedback",
        "provider_note",
      ],
    },
  },
} as const
