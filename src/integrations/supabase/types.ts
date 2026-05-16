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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          changed_fields: string[] | null
          context: Json | null
          created_at: string
          entity_id: string | null
          entity_table: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[] | null
          context?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          changed_fields?: string[] | null
          context?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_table?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      booking_units: {
        Row: {
          activity: string | null
          area: number
          booking_id: string
          building_number: number
          created_at: string
          id: string
          price: number
          unit_id: string
          unit_number: number
          unit_type: string | null
        }
        Insert: {
          activity?: string | null
          area?: number
          booking_id: string
          building_number: number
          created_at?: string
          id?: string
          price?: number
          unit_id: string
          unit_number: number
          unit_type?: string | null
        }
        Update: {
          activity?: string | null
          area?: number
          booking_id?: string
          building_number?: number
          created_at?: string
          id?: string
          price?: number
          unit_id?: string
          unit_number?: number
          unit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_units_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          business_name: string | null
          cr_number: string | null
          created_at: string
          customer_email: string | null
          customer_full_name: string
          customer_phone: string
          expires_at: string
          id: string
          notes: string | null
          offer_image_url: string | null
          offer_number: string | null
          paid_amount: number
          payment_plan: string
          status: string
          total_area: number
          total_price: number
          units_count: number
          updated_at: string
          user_id: string
          whatsapp_sent: boolean
        }
        Insert: {
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          customer_email?: string | null
          customer_full_name: string
          customer_phone: string
          expires_at?: string
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          offer_number?: string | null
          paid_amount?: number
          payment_plan?: string
          status?: string
          total_area?: number
          total_price?: number
          units_count?: number
          updated_at?: string
          user_id: string
          whatsapp_sent?: boolean
        }
        Update: {
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          customer_email?: string | null
          customer_full_name?: string
          customer_phone?: string
          expires_at?: string
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          offer_number?: string | null
          paid_amount?: number
          payment_plan?: string
          status?: string
          total_area?: number
          total_price?: number
          units_count?: number
          updated_at?: string
          user_id?: string
          whatsapp_sent?: boolean
        }
        Relationships: []
      }
      buildings: {
        Row: {
          created_at: string
          expected_annual_revenue: number
          id: string
          number: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_annual_revenue?: number
          id?: string
          number: number
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_annual_revenue?: number
          id?: string
          number?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          activity_type: string | null
          avatar_url: string | null
          business_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          purpose?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          customer_business: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          paid: boolean
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          period_end: string | null
          period_start: string | null
          receipt_image_url: string | null
          tenant_account_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_business?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_image_url?: string | null
          tenant_account_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_business?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_image_url?: string | null
          tenant_account_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          next_path: string
          provider: string
          refresh_token: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string
          id?: string
          next_path?: string
          provider: string
          refresh_token: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          next_path?: string
          provider?: string
          refresh_token?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      telegram_chat_memory: {
        Row: {
          chat_id: number
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: number
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: number
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          used_at: string | null
          used_by_chat_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          token: string
          used_at?: string | null
          used_by_chat_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          used_at?: string | null
          used_by_chat_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      telegram_subscribers: {
        Row: {
          chat_id: number
          created_at: string
          display_name: string | null
          is_admin: boolean
          last_referenced_booking_id: string | null
          last_referenced_invoice_id: string | null
          muted_until: string | null
          subscriptions: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          last_referenced_booking_id?: string | null
          last_referenced_invoice_id?: string | null
          muted_until?: string | null
          subscriptions?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          last_referenced_booking_id?: string | null
          last_referenced_invoice_id?: string | null
          muted_until?: string | null
          subscriptions?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_account_units: {
        Row: {
          created_at: string
          id: string
          tenant_account_id: string
          tenant_id: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_account_id: string
          tenant_id?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_account_id?: string
          tenant_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_account_units_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_account_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_accounts: {
        Row: {
          activity_type: string | null
          business_name: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          paid_amount: number
          phone: string | null
          total_price: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_type?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          paid_amount?: number
          phone?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          phone?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_login_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          tenant_account_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          tenant_account_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          tenant_account_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_login_links_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activity_type: string | null
          booking_id: string | null
          business_name: string | null
          cr_number: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          offer_image_url: string | null
          phone: string | null
          start_date: string | null
          tenant_name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          booking_id?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          phone?: string | null
          start_date?: string | null
          tenant_name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          booking_id?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          phone?: string | null
          start_date?: string | null
          tenant_name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_audit_log: {
        Row: {
          action: string
          building_number: number
          created_at: string
          id: string
          new_status: string | null
          performed_by: string | null
          performed_by_email: string | null
          previous_status: string | null
          reason: string
          tenant_snapshot: Json | null
          unit_id: string | null
          unit_number: number
        }
        Insert: {
          action: string
          building_number: number
          created_at?: string
          id?: string
          new_status?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          reason: string
          tenant_snapshot?: Json | null
          unit_id?: string | null
          unit_number: number
        }
        Update: {
          action?: string
          building_number?: number
          created_at?: string
          id?: string
          new_status?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          previous_status?: string | null
          reason?: string
          tenant_snapshot?: Json | null
          unit_id?: string | null
          unit_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "unit_audit_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          activity: string | null
          area: number
          building_number: number
          created_at: string
          id: string
          price: number
          status: string
          unit_number: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          area?: number
          building_number: number
          created_at?: string
          id?: string
          price?: number
          status?: string
          unit_number: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          area?: number
          building_number?: number
          created_at?: string
          id?: string
          price?: number
          status?: string
          unit_number?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_link_tenant_units: {
        Args: { _tenant_account_id: string; _unit_ids: string[] }
        Returns: undefined
      }
      admin_list_tenant_accounts: {
        Args: never
        Returns: {
          activity_type: string
          business_name: string
          cr_number: string
          created_at: string
          email: string
          full_name: string
          has_login: boolean
          id: string
          notes: string
          paid_amount: number
          phone: string
          total_price: number
          units_count: number
          unpaid_invoices: number
          unpaid_total: number
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          is_admin: boolean
          role: string
          user_id: string
        }[]
      }
      admin_set_role: {
        Args: { _make_admin: boolean; _target_user: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      admin_unlink_tenant_unit: {
        Args: { _tenant_account_id: string; _unit_id: string }
        Returns: undefined
      }
      cancel_booking: { Args: { _booking_id: string }; Returns: undefined }
      confirm_booking:
        | { Args: { _booking_id: string }; Returns: undefined }
        | {
            Args: { _booking_id: string; _paid_amount?: number }
            Returns: undefined
          }
      consolidate_existing_tenants: {
        Args: never
        Returns: {
          created_accounts: number
          linked_units: number
        }[]
      }
      create_booking:
        | {
            Args: {
              _business_name: string
              _customer_email: string
              _customer_full_name: string
              _customer_phone: string
              _notes: string
              _unit_ids: string[]
            }
            Returns: string
          }
        | {
            Args: {
              _business_name: string
              _cr_number?: string
              _customer_email: string
              _customer_full_name: string
              _customer_phone: string
              _notes: string
              _unit_ids: string[]
            }
            Returns: string
          }
        | {
            Args: {
              _business_name: string
              _cr_number?: string
              _customer_email: string
              _customer_full_name: string
              _customer_phone: string
              _notes: string
              _payment_plan?: string
              _unit_ids: string[]
            }
            Returns: string
          }
      create_telegram_link_token: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_pending_bookings: { Args: never; Returns: number }
      extend_booking_expiry: {
        Args: { _booking_id: string; _hours: number }
        Returns: string
      }
      get_invoice_for_view: {
        Args: { _invoice_id: string }
        Returns: {
          amount: number
          booking_id: string
          cr_number: string
          created_at: string
          customer_business: string
          customer_name: string
          customer_phone: string
          id: string
          invoice_number: string
          notes: string
          paid: boolean
          paid_amount: number
          paid_at: string
          payment_method: string
          tenant_account_id: string
          unit_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_my_telegram_links: {
        Args: never
        Returns: {
          chat_id: number
          created_at: string
          display_name: string
          muted_until: string
          subscriptions: string[]
        }[]
      }
      lookup_login_email: { Args: { _identifier: string }; Returns: string }
      mark_booking_whatsapp_sent: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_invoice_number: { Args: never; Returns: string }
      next_offer_number: { Args: { _booking_id?: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalc_tenant_account_total: {
        Args: { _account_id: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          _amount?: number
          _booking_id?: string
          _method?: string
          _notes?: string
          _tenant_account_id?: string
        }
        Returns: string
      }
      set_booking_paid_amount: {
        Args: { _booking_id: string; _paid_amount: number }
        Returns: undefined
      }
      set_tenant_account_paid_amount: {
        Args: { _paid_amount: number; _tenant_account_id: string }
        Returns: undefined
      }
      touch_api_key: { Args: { _id: string }; Returns: undefined }
      unlink_my_telegram: { Args: { _chat_id: number }; Returns: undefined }
      verify_api_key: {
        Args: { _key_hash: string }
        Returns: {
          id: string
          is_valid: boolean
          scopes: string[]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "control" | "manager" | "tenant"
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
      app_role: ["admin", "user", "control", "manager", "tenant"],
    },
  },
} as const
