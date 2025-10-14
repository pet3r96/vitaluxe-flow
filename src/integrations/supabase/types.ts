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
        ]
      }
      cart_lines: {
        Row: {
          cart_id: string
          created_at: string | null
          custom_dosage: string | null
          custom_sig: string | null
          destination_state: string
          id: string
          order_notes: string | null
          patient_address: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          prescription_method: string | null
          prescription_url: string | null
          price_snapshot: number | null
          product_id: string
          provider_id: string | null
          quantity: number | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_sig?: string | null
          destination_state: string
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          price_snapshot?: number | null
          product_id: string
          provider_id?: string | null
          quantity?: number | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          custom_dosage?: string | null
          custom_sig?: string | null
          destination_state?: string
          id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          price_snapshot?: number | null
          product_id?: string
          provider_id?: string | null
          quantity?: number | null
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
          order_id: string
          order_notes: string | null
          patient_address: string | null
          patient_email: string | null
          patient_id: string | null
          patient_name: string
          patient_phone: string | null
          prescription_method: string | null
          prescription_url: string | null
          prescription_url_encrypted: string | null
          price: number
          price_before_discount: number | null
          processing_at: string | null
          product_id: string
          provider_id: string | null
          quantity: number | null
          shipped_at: string | null
          shipping_carrier:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
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
          order_id: string
          order_notes?: string | null
          patient_address?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name: string
          patient_phone?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id: string
          provider_id?: string | null
          quantity?: number | null
          shipped_at?: string | null
          shipping_carrier?:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
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
          order_id?: string
          order_notes?: string | null
          patient_address?: string | null
          patient_email?: string | null
          patient_id?: string | null
          patient_name?: string
          patient_phone?: string | null
          prescription_method?: string | null
          prescription_url?: string | null
          prescription_url_encrypted?: string | null
          price?: number
          price_before_discount?: number | null
          processing_at?: string | null
          product_id?: string
          provider_id?: string | null
          quantity?: number | null
          shipped_at?: string | null
          shipping_carrier?:
            | Database["public"]["Enums"]["shipping_carrier"]
            | null
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
            foreignKeyName: "order_profits_topline_id_fkey"
            columns: ["topline_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
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
          practice_address: string | null
          report_notes: string | null
          ship_to: string | null
          shipping_verification_status: string | null
          status: string | null
          stripe_payment_id: string | null
          subtotal_before_discount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
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
          practice_address?: string | null
          report_notes?: string | null
          ship_to?: string | null
          shipping_verification_status?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          subtotal_before_discount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
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
          practice_address?: string | null
          report_notes?: string | null
          ship_to?: string | null
          shipping_verification_status?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          subtotal_before_discount?: number | null
          total_amount?: number
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
        ]
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
          address_state: string
          address_street: string
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
          address_state: string
          address_street: string
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
          address_state?: string
          address_street?: string
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
            foreignKeyName: "pharmacies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_payment_methods: {
        Row: {
          account_mask: string | null
          account_name: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          plaid_access_token: string
          plaid_account_id: string
          practice_id: string
          updated_at: string | null
        }
        Insert: {
          account_mask?: string | null
          account_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          plaid_access_token: string
          plaid_account_id: string
          practice_id: string
          updated_at?: string | null
        }
        Update: {
          account_mask?: string | null
          account_name?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          plaid_access_token?: string
          plaid_account_id?: string
          practice_id?: string
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
        ]
      }
      profiles: {
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
          company: string | null
          contract_url: string | null
          created_at: string | null
          dea: string | null
          email: string
          full_name: string | null
          id: string
          license_number: string | null
          linked_topline_id: string | null
          name: string
          npi: string | null
          parent_id: string | null
          phone: string | null
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
          updated_at: string | null
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
          company?: string | null
          contract_url?: string | null
          created_at?: string | null
          dea?: string | null
          email: string
          full_name?: string | null
          id: string
          license_number?: string | null
          linked_topline_id?: string | null
          name: string
          npi?: string | null
          parent_id?: string | null
          phone?: string | null
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
          updated_at?: string | null
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
          company?: string | null
          contract_url?: string | null
          created_at?: string | null
          dea?: string | null
          email?: string
          full_name?: string | null
          id?: string
          license_number?: string | null
          linked_topline_id?: string | null
          name?: string
          npi?: string | null
          parent_id?: string | null
          phone?: string | null
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
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "rep_practice_links_rep_id_fkey"
            columns: ["rep_id"]
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
        ]
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
        ]
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
        ]
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
      security_events_summary: {
        Row: {
          action_type: string | null
          event_count: number | null
          event_hour: string | null
          unique_ips: number | null
          unique_users: number | null
          user_role: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      can_cancel_order: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      can_downline_view_practice: {
        Args: { _downline_user_id: string; _practice_id: string }
        Returns: boolean
      }
      can_topline_view_practice: {
        Args: { _practice_id: string; _topline_user_id: string }
        Returns: boolean
      }
      can_user_impersonate: {
        Args: { _user_id: string }
        Returns: boolean
      }
      create_user_with_role: {
        Args: {
          p_email: string
          p_name: string
          p_parent_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_role_data?: Json
          p_user_id: string
        }
        Returns: Json
      }
      decrypt_plaid_token: {
        Args: { p_encrypted_token: string }
        Returns: string
      }
      encrypt_plaid_token: {
        Args: { p_token: string }
        Returns: string
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
      get_user_rep_id: {
        Args: { _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_discount_usage: {
        Args: { p_code: string }
        Returns: undefined
      }
      is_cart_owner: {
        Args: { _cart_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_entity_id?: string
          p_entity_type?: string
        }
        Returns: string
      }
      refresh_security_events_summary: {
        Args: Record<PropertyKey, never>
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
      order_status:
        | "pending"
        | "filled"
        | "shipped"
        | "denied"
        | "change_requested"
        | "delivered"
      shipping_carrier: "fedex" | "ups" | "usps"
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
      order_status: [
        "pending",
        "filled",
        "shipped",
        "denied",
        "change_requested",
        "delivered",
      ],
      shipping_carrier: ["fedex", "ups", "usps"],
    },
  },
} as const
