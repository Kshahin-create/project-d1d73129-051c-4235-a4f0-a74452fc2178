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
      access_log: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          event: string
          id: string
          ip_address: string | null
          isp: string | null
          path: string | null
          phone: string | null
          region: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          path?: string | null
          phone?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip_address?: string | null
          isp?: string | null
          path?: string | null
          phone?: string | null
          region?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      activities: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          marker: string | null
          name_ar: string
          notes: string | null
          risk_class: string | null
          short_name: string | null
          sort_order: number
          unit_type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          marker?: string | null
          name_ar: string
          notes?: string | null
          risk_class?: string | null
          short_name?: string | null
          sort_order?: number
          unit_type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          marker?: string | null
          name_ar?: string
          notes?: string | null
          risk_class?: string | null
          short_name?: string | null
          sort_order?: number
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_export_requests: {
        Row: {
          actor_role: string
          completed_at: string | null
          created_at: string
          format: string
          id: string
          list_key: string
          row_count: number | null
          scope: Json
          status: string
          user_id: string
        }
        Insert: {
          actor_role: string
          completed_at?: string | null
          created_at?: string
          format: string
          id?: string
          list_key: string
          row_count?: number | null
          scope?: Json
          status?: string
          user_id: string
        }
        Update: {
          actor_role?: string
          completed_at?: string | null
          created_at?: string
          format?: string
          id?: string
          list_key?: string
          row_count?: number | null
          scope?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_list_preferences: {
        Row: {
          id: string
          list_key: string
          name: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          list_key: string
          name: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          list_key?: string
          name?: string
          settings?: Json
          updated_at?: string
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
          api_cors_allowlist: string[]
          buildings_sheet_id: string | null
          buildings_sheet_last_direction: string | null
          buildings_sheet_last_sync_at: string | null
          hold_hours: number
          id: number
          leads_sheet_id: string | null
          leads_sheet_last_sync_at: string | null
          leads_sheet_name: string | null
          maintenance_message: string | null
          maintenance_mode: boolean
          max_hold_extensions: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_cors_allowlist?: string[]
          buildings_sheet_id?: string | null
          buildings_sheet_last_direction?: string | null
          buildings_sheet_last_sync_at?: string | null
          hold_hours?: number
          id?: number
          leads_sheet_id?: string | null
          leads_sheet_last_sync_at?: string | null
          leads_sheet_name?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_hold_extensions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_cors_allowlist?: string[]
          buildings_sheet_id?: string | null
          buildings_sheet_last_direction?: string | null
          buildings_sheet_last_sync_at?: string | null
          hold_hours?: number
          id?: number
          leads_sheet_id?: string | null
          leads_sheet_last_sync_at?: string | null
          leads_sheet_name?: string | null
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_hold_extensions?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      archived_rows: {
        Row: {
          archive_reason: string
          archived_at: string
          archived_by: string | null
          id: string
          row_data: Json
          row_id: string | null
          table_name: string
        }
        Insert: {
          archive_reason: string
          archived_at?: string
          archived_by?: string | null
          id?: string
          row_data: Json
          row_id?: string | null
          table_name: string
        }
        Update: {
          archive_reason?: string
          archived_at?: string
          archived_by?: string | null
          id?: string
          row_data?: Json
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      assignment_state: {
        Row: {
          id: number
          last_assigned_index: number
        }
        Insert: {
          id?: number
          last_assigned_index?: number
        }
        Update: {
          id?: number
          last_assigned_index?: number
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          business_name: string | null
          confirmation_sent_at: string | null
          cr_number: string | null
          created_at: string
          customer_email: string | null
          customer_full_name: string
          customer_phone: string
          expires_at: string
          hold_extensions: number
          id: string
          id_type: string | null
          is_returning_customer: boolean
          notes: string | null
          offer_image_url: string | null
          offer_number: string | null
          paid_amount: number
          party_id: string | null
          payment_plan: string
          previous_tenant_account_id: string | null
          reminder_12h_sent_at: string | null
          reminder_4h_sent_at: string | null
          status: string
          total_area: number
          total_price: number
          units_count: number
          updated_at: string
          user_id: string
          whatsapp_sent: boolean
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          confirmation_sent_at?: string | null
          cr_number?: string | null
          created_at?: string
          customer_email?: string | null
          customer_full_name: string
          customer_phone: string
          expires_at?: string
          hold_extensions?: number
          id?: string
          id_type?: string | null
          is_returning_customer?: boolean
          notes?: string | null
          offer_image_url?: string | null
          offer_number?: string | null
          paid_amount?: number
          party_id?: string | null
          payment_plan?: string
          previous_tenant_account_id?: string | null
          reminder_12h_sent_at?: string | null
          reminder_4h_sent_at?: string | null
          status?: string
          total_area?: number
          total_price?: number
          units_count?: number
          updated_at?: string
          user_id: string
          whatsapp_sent?: boolean
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          confirmation_sent_at?: string | null
          cr_number?: string | null
          created_at?: string
          customer_email?: string | null
          customer_full_name?: string
          customer_phone?: string
          expires_at?: string
          hold_extensions?: number
          id?: string
          id_type?: string | null
          is_returning_customer?: boolean
          notes?: string | null
          offer_image_url?: string | null
          offer_number?: string | null
          paid_amount?: number
          party_id?: string | null
          payment_plan?: string
          previous_tenant_account_id?: string | null
          reminder_12h_sent_at?: string | null
          reminder_4h_sent_at?: string | null
          status?: string
          total_area?: number
          total_price?: number
          units_count?: number
          updated_at?: string
          user_id?: string
          whatsapp_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bookings_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_previous_tenant_account_id_fkey"
            columns: ["previous_tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      building_activities: {
        Row: {
          activity_id: string
          building_id: string
          created_at: string
          id: string
        }
        Insert: {
          activity_id: string
          building_id: string
          created_at?: string
          id?: string
        }
        Update: {
          activity_id?: string
          building_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "building_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "building_activities_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          activity_id: string | null
          booking_enabled: boolean
          created_at: string
          expected_annual_revenue: number
          id: string
          is_published: boolean
          number: number
          phase: number | null
          type: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          booking_enabled?: boolean
          created_at?: string
          expected_annual_revenue?: number
          id?: string
          is_published?: boolean
          number: number
          phase?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          booking_enabled?: boolean
          created_at?: string
          expected_annual_revenue?: number
          id?: string
          is_published?: boolean
          number?: number
          phase?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buildings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_units: {
        Row: {
          annual_rent_excl_vat: number | null
          contract_id: string
          id: string
          unit_id: string
        }
        Insert: {
          annual_rent_excl_vat?: number | null
          contract_id: string
          id?: string
          unit_id: string
        }
        Update: {
          annual_rent_excl_vat?: number | null
          contract_id?: string
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_units_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          annual_rent_excl_vat: number | null
          booking_id: string | null
          contract_no: string
          created_at: string
          created_by: string | null
          documents: Json
          end_date: string | null
          id: string
          legacy_contract_id: string | null
          needs_review: boolean
          party_id: string | null
          payment_plan_id: string | null
          reason: string
          signed_at: string | null
          start_date: string | null
          status: string
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          annual_rent_excl_vat?: number | null
          booking_id?: string | null
          contract_no: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          end_date?: string | null
          id?: string
          legacy_contract_id?: string | null
          needs_review?: boolean
          party_id?: string | null
          payment_plan_id?: string | null
          reason: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          annual_rent_excl_vat?: number | null
          booking_id?: string | null
          contract_no?: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          end_date?: string | null
          id?: string
          legacy_contract_id?: string | null
          needs_review?: boolean
          party_id?: string | null
          payment_plan_id?: string | null
          reason?: string
          signed_at?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_legacy_contract_id_fkey"
            columns: ["legacy_contract_id"]
            isOneToOne: true
            referencedRelation: "unit_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_payment_plan_id_fkey"
            columns: ["payment_plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          activity_type: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          avatar_url: string | null
          business_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          id_type: string | null
          notes: string | null
          party_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_type?: string | null
          notes?: string | null
          party_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          id_type?: string | null
          notes?: string | null
          party_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_candidates: {
        Row: {
          candidate_party_id: string | null
          created_at: string
          id: string
          match_reason: string
          party_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_id: string | null
          source_table: string | null
          status: string
        }
        Insert: {
          candidate_party_id?: string | null
          created_at?: string
          id?: string
          match_reason: string
          party_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
        }
        Update: {
          candidate_party_id?: string | null
          created_at?: string
          id?: string
          match_reason?: string
          party_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_candidates_candidate_party_id_fkey"
            columns: ["candidate_party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_candidates_candidate_party_id_fkey"
            columns: ["candidate_party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_candidates_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_candidates_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
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
      finance_cutover: {
        Row: {
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          id: number
        }
        Insert: {
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: number
        }
        Update: {
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          id?: number
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number
          contract_id: string
          created_at: string
          due_date: string
          id: string
          sequence_no: number
          status: string
          vat_amount: number
          waived_at: string | null
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          amount_excl_vat: number
          amount_incl_vat: number
          contract_id: string
          created_at?: string
          due_date: string
          id?: string
          sequence_no: number
          status?: string
          vat_amount: number
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          contract_id?: string
          created_at?: string
          due_date?: string
          id?: string
          sequence_no?: number
          status?: string
          vat_amount?: number
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      interested_customers: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          business_name: string | null
          created_at: string
          created_by: string | null
          customer_source: string | null
          full_name: string
          id: string
          notes: string | null
          party_id: string | null
          phone: string
          requested_activity: string | null
          requested_building: string | null
          requested_unit: string | null
          source: string
          status: string
          telegram_chat_id: number | null
          telegram_message_id: number | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_source?: string | null
          full_name: string
          id?: string
          notes?: string | null
          party_id?: string | null
          phone: string
          requested_activity?: string | null
          requested_building?: string | null
          requested_unit?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_source?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          party_id?: string | null
          phone?: string
          requested_activity?: string | null
          requested_building?: string | null
          requested_unit?: string | null
          source?: string
          status?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interested_customers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interested_customers_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
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
          reversal_reason: string | null
          reverses_id: string | null
          tenant_account_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          reversal_reason?: string | null
          reverses_id?: string | null
          tenant_account_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          reversal_reason?: string | null
          reverses_id?: string | null
          tenant_account_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          last_message_at: string | null
          last_message_text: string | null
          notes: string | null
          party_id: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          notes?: string | null
          party_id?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          last_message_at?: string | null
          last_message_text?: string | null
          notes?: string | null
          party_id?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          audience_summary: Json
          channel_id: number
          components: Json
          created_at: string
          created_by: string
          id: string
          language: string
          name: string
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          audience_summary: Json
          channel_id: number
          components?: Json
          created_at?: string
          created_by: string
          id?: string
          language: string
          name: string
          status?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          audience_summary?: Json
          channel_id?: number
          components?: Json
          created_at?: string
          created_by?: string
          id?: string
          language?: string
          name?: string
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_recipients: {
        Row: {
          attempted_at: string | null
          campaign_id: string
          error: string | null
          id: string
          phone: string
          provider_response: Json | null
          sources: string[]
          status: string
          updated_at: string
        }
        Insert: {
          attempted_at?: string | null
          campaign_id: string
          error?: string | null
          id?: string
          phone: string
          provider_response?: Json | null
          sources: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          attempted_at?: string | null
          campaign_id?: string
          error?: string | null
          id?: string
          phone?: string
          provider_response?: Json | null
          sources?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
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
      opportunities: {
        Row: {
          activity_id: string | null
          area_needed_m2: number | null
          booking_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_to: string | null
          next_action: string | null
          next_action_at: string | null
          no_answer_attempts: number
          notes: string | null
          outcome: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason: string | null
          owner_user_id: string | null
          party_id: string
          preferred_unit_ids: string[] | null
          revisit_at: string | null
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          area_needed_m2?: number | null
          booking_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lost_to?: string | null
          next_action?: string | null
          next_action_at?: string | null
          no_answer_attempts?: number
          notes?: string | null
          outcome?: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason?: string | null
          owner_user_id?: string | null
          party_id: string
          preferred_unit_ids?: string[] | null
          revisit_at?: string | null
          source?: Database["public"]["Enums"]["opportunity_source"]
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          area_needed_m2?: number | null
          booking_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lost_to?: string | null
          next_action?: string | null
          next_action_at?: string | null
          no_answer_attempts?: number
          notes?: string | null
          outcome?: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason?: string | null
          owner_user_id?: string | null
          party_id?: string
          preferred_unit_ids?: string[] | null
          revisit_at?: string | null
          source?: Database["public"]["Enums"]["opportunity_source"]
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["opportunity_activity_type"]
          actor_id: string | null
          created_at: string
          id: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          opportunity_id: string
          outcome: Database["public"]["Enums"]["opportunity_activity_outcome"]
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["opportunity_activity_type"]
          actor_id?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          opportunity_id: string
          outcome: Database["public"]["Enums"]["opportunity_activity_outcome"]
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["opportunity_activity_type"]
          actor_id?: string | null
          created_at?: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          opportunity_id?: string
          outcome?: Database["public"]["Enums"]["opportunity_activity_outcome"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_owner_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_owner: string | null
          id: string
          opportunity_id: string
          reason: string
          to_owner: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_owner?: string | null
          id?: string
          opportunity_id: string
          reason: string
          to_owner?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_owner?: string | null
          id?: string
          opportunity_id?: string
          reason?: string
          to_owner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_owner_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_owner_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      parties: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          id_number: string | null
          id_type: string | null
          merged_into_id: string | null
          name_ar: string
          name_en: string | null
          party_type: Database["public"]["Enums"]["party_type"]
          phone: string | null
          source: string | null
          tenant_code: string
          tenant_lifecycle:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          merged_into_id?: string | null
          name_ar: string
          name_en?: string | null
          party_type?: Database["public"]["Enums"]["party_type"]
          phone?: string | null
          source?: string | null
          tenant_code: string
          tenant_lifecycle?:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          merged_into_id?: string | null
          name_ar?: string
          name_en?: string | null
          party_type?: Database["public"]["Enums"]["party_type"]
          phone?: string | null
          source?: string | null
          tenant_code?: string
          tenant_lifecycle?:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parties_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parties_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      party_code_counter: {
        Row: {
          id: number
          next_value: number
        }
        Insert: {
          id?: number
          next_value?: number
        }
        Update: {
          id?: number
          next_value?: number
        }
        Relationships: []
      }
      party_contacts: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          party_id: string
          phone: string | null
          role_label: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          party_id: string
          phone?: string | null
          role_label?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          party_id?: string
          phone?: string | null
          role_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_contacts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_contacts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          created_at: string
          due_day: number | null
          id: string
          installments_count: number
          interval_months: number
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_day?: number | null
          id?: string
          installments_count: number
          interval_months: number
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_day?: number | null
          id?: string
          installments_count?: number
          interval_months?: number
          is_active?: boolean
          name?: string
          updated_at?: string
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
      receipt_allocations: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number
          created_at: string
          id: string
          installment_id: string
          receipt_id: string
          reverses_id: string | null
          vat_amount: number
        }
        Insert: {
          amount_excl_vat: number
          amount_incl_vat: number
          created_at?: string
          id?: string
          installment_id: string
          receipt_id: string
          reverses_id?: string | null
          vat_amount: number
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number
          created_at?: string
          id?: string
          installment_id?: string
          receipt_id?: string
          reverses_id?: string | null
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_cash_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "receipt_allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_legacy_sources: {
        Row: {
          canonical_receipt_id: string | null
          id: string
          original_amount: number
          receipt_id: string
          resolution: string
          resolution_reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          rounded_amount: number
          source_archived: boolean
          source_id: string
          source_recorded_at: string
          source_table: string
          unit_id: string | null
        }
        Insert: {
          canonical_receipt_id?: string | null
          id?: string
          original_amount: number
          receipt_id: string
          resolution?: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rounded_amount: number
          source_archived?: boolean
          source_id: string
          source_recorded_at: string
          source_table: string
          unit_id?: string | null
        }
        Update: {
          canonical_receipt_id?: string | null
          id?: string
          original_amount?: number
          receipt_id?: string
          resolution?: string
          resolution_reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rounded_amount?: number
          source_archived?: boolean
          source_id?: string
          source_recorded_at?: string
          source_table?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_legacy_sources_canonical_receipt_id_fkey"
            columns: ["canonical_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_cash_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_canonical_receipt_id_fkey"
            columns: ["canonical_receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_cash_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_excl_vat: number
          amount_incl_vat: number | null
          archived_at: string | null
          booking_id: string | null
          contract_id: string | null
          id: string
          idempotency_key: string | null
          method: string
          paid_at: string | null
          party_id: string | null
          proof_bucket: string
          proof_file: string | null
          reason: string
          receipt_no: string
          recorded_at: string
          recorded_by: string | null
          reverses_id: string | null
          status: string
          vat_amount: number | null
          vat_documented: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_excl_vat: number
          amount_incl_vat?: number | null
          archived_at?: string | null
          booking_id?: string | null
          contract_id?: string | null
          id?: string
          idempotency_key?: string | null
          method: string
          paid_at?: string | null
          party_id?: string | null
          proof_bucket?: string
          proof_file?: string | null
          reason: string
          receipt_no?: string
          recorded_at?: string
          recorded_by?: string | null
          reverses_id?: string | null
          status?: string
          vat_amount?: number | null
          vat_documented?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_excl_vat?: number
          amount_incl_vat?: number | null
          archived_at?: string | null
          booking_id?: string | null
          contract_id?: string | null
          id?: string
          idempotency_key?: string | null
          method?: string
          paid_at?: string | null
          party_id?: string | null
          proof_bucket?: string
          proof_file?: string | null
          reason?: string
          receipt_no?: string
          recorded_at?: string
          recorded_by?: string | null
          reverses_id?: string | null
          status?: string
          vat_amount?: number | null
          vat_documented?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "receipt_cash_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
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
      system_backups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          size_bytes: number
          storage_path: string
          table_counts: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          notes?: string | null
          size_bytes?: number
          storage_path: string
          table_counts?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          size_bytes?: number
          storage_path?: string
          table_counts?: Json
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
      tenant_account_files: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          custom_name: string
          id: string
          is_archived: boolean
          mime_type: string | null
          notes: string | null
          original_name: string | null
          size_bytes: number | null
          storage_path: string
          tenant_account_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          custom_name: string
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          notes?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_account_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          custom_name?: string
          id?: string
          is_archived?: boolean
          mime_type?: string | null
          notes?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_account_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_account_files_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_account_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_account_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_account_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_accounts: {
        Row: {
          activity_type: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          business_name: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          merge_snapshot: Json | null
          merged_at: string | null
          merged_by: string | null
          merged_into: string | null
          merged_into_id: string | null
          notes: string | null
          paid_amount: number
          party_id: string | null
          phone: string | null
          total_price: number
          unmerged_at: string | null
          unmerged_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          merge_snapshot?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into?: string | null
          merged_into_id?: string | null
          notes?: string | null
          paid_amount?: number
          party_id?: string | null
          phone?: string | null
          total_price?: number
          unmerged_at?: string | null
          unmerged_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          merge_snapshot?: Json | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into?: string | null
          merged_into_id?: string | null
          notes?: string | null
          paid_amount?: number
          party_id?: string | null
          phone?: string | null
          total_price?: number
          unmerged_at?: string | null
          unmerged_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_accounts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_accounts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_accounts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_accounts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          booking_id: string | null
          business_name: string | null
          cr_number: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          offer_image_url: string | null
          party_id: string | null
          phone: string | null
          start_date: string | null
          tenant_name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          booking_id?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          party_id?: string | null
          phone?: string | null
          start_date?: string | null
          tenant_name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          activity_type?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          booking_id?: string | null
          business_name?: string | null
          cr_number?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          offer_image_url?: string | null
          party_id?: string | null
          phone?: string | null
          start_date?: string | null
          tenant_name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_requests: {
        Row: {
          created_at: string
          current_owner: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          opportunity_id: string
          reason: string
          requested_by: string
          status: string
        }
        Insert: {
          created_at?: string
          current_owner?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          opportunity_id: string
          reason: string
          requested_by: string
          status?: string
        }
        Update: {
          created_at?: string
          current_owner?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          opportunity_id?: string
          reason?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_requests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_requests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunity_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_activities: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          unit_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          unit_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_activities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_activities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_activities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_activities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
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
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_audit_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_audit_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_audit_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_collections: {
        Row: {
          amount: number
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_archived: boolean
          proof_mime: string | null
          proof_name: string | null
          proof_path: string | null
          proof_size: number | null
          reversal_reason: string | null
          reverses_id: string | null
          tenant_account_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          proof_mime?: string | null
          proof_name?: string | null
          proof_path?: string | null
          proof_size?: number | null
          reversal_reason?: string | null
          reverses_id?: string | null
          tenant_account_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_archived?: boolean
          proof_mime?: string | null
          proof_name?: string | null
          proof_path?: string | null
          proof_size?: number | null
          reversal_reason?: string | null
          reverses_id?: string | null
          tenant_account_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_collections_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "unit_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_collections_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_collections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_collections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_collections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_collections_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_contracts: {
        Row: {
          booking_id: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          starts_on: string | null
          status: string
          status_reason: string
          tenant_account_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          contract_number: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          starts_on?: string | null
          status?: string
          status_reason: string
          tenant_account_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          starts_on?: string | null
          status?: string
          status_reason?: string
          tenant_account_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_contracts_tenant_account_id_fkey"
            columns: ["tenant_account_id"]
            isOneToOne: false
            referencedRelation: "tenant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_contracts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          notes: string | null
          size_bytes: number | null
          storage_path: string
          unit_id: string
          uploaded_by: string | null
          uploaded_by_email: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path: string
          unit_id: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          size_bytes?: number | null
          storage_path?: string
          unit_id?: string
          uploaded_by?: string | null
          uploaded_by_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_files_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_files_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_files_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_files_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_first_payment_verifications: {
        Row: {
          contract_id: string
          id: string
          reason: string
          receipt_id: string
          receipt_type: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          contract_id: string
          id?: string
          reason: string
          receipt_id: string
          receipt_type: string
          verified_at?: string
          verified_by: string
        }
        Update: {
          contract_id?: string
          id?: string
          reason?: string
          receipt_id?: string
          receipt_type?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_first_payment_verifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "unit_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          reason: string
          summary: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          reason: string
          summary?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          reason?: string
          summary?: Json
        }
        Relationships: []
      }
      unit_status_backfill_review: {
        Row: {
          created_at: string
          evidence: Json
          id: string
          original_status: string
          proposed_status:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string
          evidence?: Json
          id?: string
          original_status: string
          proposed_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string
          evidence?: Json
          id?: string
          original_status?: string
          proposed_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_status_backfill_review_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_backfill_review_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_backfill_review_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_backfill_review_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_status_history: {
        Row: {
          actor: string | null
          actor_role: string | null
          at: string
          from_status: Database["public"]["Enums"]["unit_leasing_status"] | null
          id: string
          reason: string
          ref_id: string | null
          ref_type: string
          to_status: Database["public"]["Enums"]["unit_leasing_status"] | null
          unit_id: string
        }
        Insert: {
          actor?: string | null
          actor_role?: string | null
          at?: string
          from_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          id?: string
          reason: string
          ref_id?: string | null
          ref_type: string
          to_status?: Database["public"]["Enums"]["unit_leasing_status"] | null
          unit_id: string
        }
        Update: {
          actor?: string | null
          actor_role?: string | null
          at?: string
          from_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string
          to_status?: Database["public"]["Enums"]["unit_leasing_status"] | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_status_history_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_status_write_capabilities: {
        Row: {
          transaction_id: number
          unit_id: string
        }
        Insert: {
          transaction_id: number
          unit_id: string
        }
        Update: {
          transaction_id?: number
          unit_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          activity: string | null
          activity_id: string | null
          area: number
          area_m2: number | null
          building_id: string | null
          building_number: number
          created_at: string
          id: string
          is_test: boolean
          leasing_status:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized: boolean
          price: number
          publish_state: string
          status: string
          status_before_maintenance: string | null
          unit_number: number
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          activity_id?: string | null
          area?: number
          area_m2?: number | null
          building_id?: string | null
          building_number: number
          created_at?: string
          id?: string
          is_test?: boolean
          leasing_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized?: boolean
          price?: number
          publish_state?: string
          status?: string
          status_before_maintenance?: string | null
          unit_number: number
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          activity_id?: string | null
          area?: number
          area_m2?: number | null
          building_id?: string | null
          building_number?: number
          created_at?: string
          id?: string
          is_test?: boolean
          leasing_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized?: boolean
          price?: number
          publish_state?: string
          status?: string
          status_before_maintenance?: string | null
          unit_number?: number
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "public_buildings"
            referencedColumns: ["number"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      finance_source_integrity: {
        Row: {
          changed_source: boolean | null
          missing_mapping: boolean | null
          missing_source: boolean | null
          source_id: string | null
          source_table: string | null
        }
        Relationships: []
      }
      finance_unit_report: {
        Row: {
          building_number: number | null
          collected_excl_vat: number | null
          collected_vat: number | null
          contract_rent: number | null
          id: string | null
          leasing_status:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          receipts_count: number | null
          remaining_incl_vat: number | null
          unit_number: number | null
          unit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "public_buildings"
            referencedColumns: ["number"]
          },
        ]
      }
      installments_read: {
        Row: {
          amount_excl_vat: number | null
          amount_incl_vat: number | null
          contract_id: string | null
          created_at: string | null
          current_status: string | null
          due_date: string | null
          id: string | null
          sequence_no: number | null
          status: string | null
          vat_amount: number | null
          waived_at: string | null
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          amount_excl_vat?: number | null
          amount_incl_vat?: number | null
          contract_id?: string | null
          created_at?: string | null
          current_status?: never
          due_date?: string | null
          id?: string | null
          sequence_no?: number | null
          status?: string | null
          vat_amount?: number | null
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          amount_excl_vat?: number | null
          amount_incl_vat?: number | null
          contract_id?: string | null
          created_at?: string | null
          current_status?: never
          due_date?: string | null
          id?: string | null
          sequence_no?: number | null
          status?: string | null
          vat_amount?: number | null
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_alerts: {
        Row: {
          alert_kind: string | null
          id: string | null
          next_action: string | null
          next_action_at: string | null
          owner_user_id: string | null
          party_id: string | null
          stage: Database["public"]["Enums"]["opportunity_stage"] | null
          updated_at: string | null
        }
        Insert: {
          alert_kind?: never
          id?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          party_id?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          updated_at?: string | null
        }
        Update: {
          alert_kind?: never
          id?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          party_id?: string | null
          stage?: Database["public"]["Enums"]["opportunity_stage"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
        ]
      }
      parties_crm: {
        Row: {
          archived_at: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string | null
          id_number: string | null
          id_type: string | null
          name_ar: string | null
          name_en: string | null
          party_type: Database["public"]["Enums"]["party_type"] | null
          phone: string | null
          source: string | null
          tenant_code: string | null
          tenant_lifecycle:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          id_number?: never
          id_type?: never
          name_ar?: string | null
          name_en?: string | null
          party_type?: Database["public"]["Enums"]["party_type"] | null
          phone?: never
          source?: string | null
          tenant_code?: string | null
          tenant_lifecycle?:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          id_number?: never
          id_type?: never
          name_ar?: string | null
          name_en?: string | null
          party_type?: Database["public"]["Enums"]["party_type"] | null
          phone?: never
          source?: string | null
          tenant_code?: string | null
          tenant_lifecycle?:
            | Database["public"]["Enums"]["tenant_lifecycle"]
            | null
        }
        Relationships: []
      }
      public_activities: {
        Row: {
          code: string | null
          description: string | null
          marker: string | null
          name_ar: string | null
          risk_class: string | null
          short_name: string | null
          sort_order: number | null
          unit_type: string | null
        }
        Insert: {
          code?: string | null
          description?: string | null
          marker?: string | null
          name_ar?: string | null
          risk_class?: string | null
          short_name?: string | null
          sort_order?: number | null
          unit_type?: string | null
        }
        Update: {
          code?: string | null
          description?: string | null
          marker?: string | null
          name_ar?: string | null
          risk_class?: string | null
          short_name?: string | null
          sort_order?: number | null
          unit_type?: string | null
        }
        Relationships: []
      }
      public_building_activities: {
        Row: {
          activity_code: string | null
          building_number: number | null
        }
        Relationships: []
      }
      public_buildings: {
        Row: {
          activity_code: string | null
          booking_enabled: boolean | null
          expected_annual_revenue: number | null
          number: number | null
          phase: number | null
          type: string | null
        }
        Relationships: []
      }
      public_unit_activities: {
        Row: {
          activity_code: string | null
          building_number: number | null
          unit_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "public_buildings"
            referencedColumns: ["number"]
          },
        ]
      }
      public_units: {
        Row: {
          activity: string | null
          activity_code: string | null
          area: number | null
          building_number: number | null
          id: string | null
          leasing_status: string | null
          price: number | null
          status: string | null
          unit_number: number | null
          unit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "public_buildings"
            referencedColumns: ["number"]
          },
        ]
      }
      receipt_cash_read: {
        Row: {
          amount_excl_vat: number | null
          amount_incl_vat: number | null
          archived_at: string | null
          booking_id: string | null
          contract_id: string | null
          id: string | null
          idempotency_key: string | null
          method: string | null
          paid_at: string | null
          party_id: string | null
          proof_bucket: string | null
          proof_file: string | null
          reason: string | null
          receipt_no: string | null
          recorded_at: string | null
          recorded_by: string | null
          reverses_id: string | null
          status: string | null
          vat_amount: number | null
          vat_documented: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_excl_vat?: number | null
          amount_incl_vat?: number | null
          archived_at?: string | null
          booking_id?: string | null
          contract_id?: string | null
          id?: string | null
          idempotency_key?: string | null
          method?: string | null
          paid_at?: string | null
          party_id?: string | null
          proof_bucket?: string | null
          proof_file?: string | null
          reason?: string | null
          receipt_no?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          reverses_id?: string | null
          status?: string | null
          vat_amount?: number | null
          vat_documented?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_excl_vat?: number | null
          amount_incl_vat?: number | null
          archived_at?: string | null
          booking_id?: string | null
          contract_id?: string | null
          id?: string | null
          idempotency_key?: string | null
          method?: string | null
          paid_at?: string | null
          party_id?: string | null
          proof_bucket?: string | null
          proof_file?: string | null
          reason?: string | null
          receipt_no?: string | null
          recorded_at?: string | null
          recorded_by?: string | null
          reverses_id?: string | null
          status?: string | null
          vat_amount?: number | null
          vat_documented?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties_crm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "receipt_cash_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: true
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_reconciliation: {
        Row: {
          month: string | null
          original_total: number | null
          pending_review: number | null
          precision_difference: number | null
          receipt_total: number | null
          rounded_total: number | null
          rows: number | null
          source_archived: boolean | null
          source_table: string | null
          unexplained_difference: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "finance_unit_report"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "public_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_legacy_sources_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units_status_read"
            referencedColumns: ["id"]
          },
        ]
      }
      units_status_read: {
        Row: {
          activity: string | null
          activity_id: string | null
          area: number | null
          area_m2: number | null
          building_id: string | null
          building_number: number | null
          created_at: string | null
          id: string | null
          is_test: boolean | null
          leasing_status:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized: boolean | null
          price: number | null
          publish_state: string | null
          status: string | null
          status_before_maintenance: string | null
          unit_number: number | null
          unit_type: string | null
          updated_at: string | null
        }
        Insert: {
          activity?: string | null
          activity_id?: string | null
          area?: number | null
          area_m2?: number | null
          building_id?: string | null
          building_number?: number | null
          created_at?: string | null
          id?: string | null
          is_test?: boolean | null
          leasing_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized?: boolean | null
          price?: number | null
          publish_state?: string | null
          status?: never
          status_before_maintenance?: string | null
          unit_number?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Update: {
          activity?: string | null
          activity_id?: string | null
          area?: number | null
          area_m2?: number | null
          building_id?: string | null
          building_number?: number | null
          created_at?: string | null
          id?: string | null
          is_test?: boolean | null
          leasing_status?:
            | Database["public"]["Enums"]["unit_leasing_status"]
            | null
          leasing_status_initialized?: boolean | null
          price?: number | null
          publish_state?: string | null
          status?: never
          status_before_maintenance?: string | null
          unit_number?: number | null
          unit_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "units_building_number_fkey"
            columns: ["building_number"]
            isOneToOne: false
            referencedRelation: "public_buildings"
            referencedColumns: ["number"]
          },
        ]
      }
    }
    Functions: {
      _assert_admin_writer: { Args: never; Returns: undefined }
      _assert_reason: { Args: { _reason: string }; Returns: string }
      _safety_audit: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _id: string
          _reason: string
          _table: string
        }
        Returns: undefined
      }
      activate_contract: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      adjust_payment: {
        Args: { _amount: number; _notes?: string; _tenant_account_id: string }
        Returns: string
      }
      admin_auto_merge_duplicate_tenants: { Args: never; Returns: Json }
      admin_link_tenant_units: {
        Args: { _tenant_account_id: string; _unit_ids: string[] }
        Returns: undefined
      }
      admin_list_inactive_tenant_accounts: {
        Args: never
        Returns: {
          at: string
          business_name: string
          can_unmerge: boolean
          full_name: string
          id: string
          kind: string
          merged_into_id: string
          merged_into_name: string
          phone: string
          reason: string
        }[]
      }
      admin_list_tenant_accounts: {
        Args: never
        Returns: {
          activity_type: string
          business_name: string
          collected_total: number
          cr_number: string
          created_at: string
          email: string
          files_count: number
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
      admin_merge_tenant_accounts: {
        Args: { _canonical_id: string; _duplicate_ids: string[] }
        Returns: Json
      }
      admin_paid_tenants_page: {
        Args: {
          _ascending?: boolean
          _limit?: number
          _offset?: number
          _search?: string
          _sort?: string
        }
        Returns: Json
      }
      admin_party_units_page: {
        Args: { _limit?: number; _offset?: number; _party: string }
        Returns: Json
      }
      admin_pipeline_page: {
        Args: {
          _limit?: number
          _offset?: number
          _owner?: string
          _search?: string
          _source?: string
          _stage?: string
        }
        Returns: Json
      }
      admin_set_building_registry: {
        Args: {
          _building_number: number
          _extra_codes: string[]
          _is_published: boolean
          _phase: number
          _primary_code: string
          _reason: string
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: { _make_admin: boolean; _target_user: string }
        Returns: undefined
      }
      admin_set_unit_test: {
        Args: { _is_test: boolean; _reason: string; _unit_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      admin_tenant_accounts_page: {
        Args: {
          _ascending?: boolean
          _filter?: string
          _limit?: number
          _offset?: number
          _search?: string
          _sort?: string
        }
        Returns: Json
      }
      admin_unit_timeline: {
        Args: { _limit?: number; _offset?: number; _unit: string }
        Returns: Json
      }
      admin_units_needing_completion: {
        Args: {
          _issue?: string
          _limit?: number
          _offset?: number
          _search?: string
        }
        Returns: Json
      }
      admin_unlink_tenant_unit: {
        Args: { _tenant_account_id: string; _unit_id: string }
        Returns: undefined
      }
      admin_unmerge_tenant_account: {
        Args: { _merged_id: string; _reason: string }
        Returns: Json
      }
      admin_upsert_activity: {
        Args: {
          _code: string
          _description: string
          _id: string
          _is_active: boolean
          _marker: string
          _name_ar: string
          _notes: string
          _reason: string
          _risk_class: string
          _short_name: string
          _sort_order: number
          _unit_type: string
        }
        Returns: string
      }
      admin_user_directory: { Args: never; Returns: Json }
      admin_user_directory_page: {
        Args: {
          _ascending?: boolean
          _limit?: number
          _offset?: number
          _role?: string
          _search?: string
          _sort?: string
        }
        Returns: Json
      }
      allocate_receipt: {
        Args: {
          _amount_excl_vat: number
          _installment: string
          _reason: string
          _receipt: string
          _vat_amount: number
        }
        Returns: string
      }
      approve_transfer: {
        Args: { _approve: boolean; _notes?: string; _request_id: string }
        Returns: {
          created_at: string
          current_owner: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          opportunity_id: string
          reason: string
          requested_by: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "transfer_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_record: {
        Args: { _id: string; _reason: string; _table: string }
        Returns: undefined
      }
      archive_tenant: {
        Args: { _reason: string; _unit_id: string }
        Returns: Json
      }
      archive_tenant_account: {
        Args: { _reason: string; _tenant_account_id: string }
        Returns: undefined
      }
      assign_next_agent: { Args: never; Returns: string }
      assign_opportunity: {
        Args: { _opportunity_id: string; _reason: string; _to_user: string }
        Returns: {
          activity_id: string | null
          area_needed_m2: number | null
          booking_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_to: string | null
          next_action: string | null
          next_action_at: string | null
          no_answer_attempts: number
          notes: string | null
          outcome: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason: string | null
          owner_user_id: string | null
          party_id: string
          preferred_unit_ids: string[] | null
          revisit_at: string | null
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "opportunities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_reassign_opportunities: {
        Args: { _from_user: string; _reason: string; _to_user: string }
        Returns: number
      }
      cancel_booking: { Args: { _booking_id: string }; Returns: undefined }
      cancel_booking_with_reason: {
        Args: { _booking_id: string; _reason: string }
        Returns: undefined
      }
      claim_marketing_recipient: {
        Args: { _campaign_id: string }
        Returns: {
          attempted_at: string | null
          campaign_id: string
          error: string | null
          id: string
          phone: string
          provider_response: Json | null
          sources: string[]
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "marketing_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_admin_export: {
        Args: { _count: number; _id: string; _status: string }
        Returns: undefined
      }
      confirm_booking:
        | { Args: { _booking_id: string }; Returns: undefined }
        | {
            Args: { _booking_id: string; _paid_amount?: number }
            Returns: undefined
          }
      confirm_booking_transition: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      consolidate_existing_tenants: {
        Args: never
        Returns: {
          created_accounts: number
          linked_units: number
        }[]
      }
      control_set_maintenance: {
        Args: { _on: boolean; _unit_id: string }
        Returns: string
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
        | {
            Args: {
              _business_name: string
              _cr_number: string
              _customer_email: string
              _customer_full_name: string
              _customer_phone: string
              _id_type: string
              _notes: string
              _payment_plan: string
              _unit_ids: string[]
            }
            Returns: string
          }
      create_contract: {
        Args: { _data: Json; _reason: string }
        Returns: string
      }
      create_opportunity: {
        Args: {
          _activity_id?: string
          _area_needed_m2?: number
          _next_action?: string
          _next_action_at?: string
          _notes?: string
          _owner_user_id?: string
          _party_id: string
          _source?: Database["public"]["Enums"]["opportunity_source"]
        }
        Returns: {
          activity_id: string | null
          area_needed_m2: number | null
          booking_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_to: string | null
          next_action: string | null
          next_action_at: string | null
          no_answer_attempts: number
          notes: string | null
          outcome: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason: string | null
          owner_user_id: string | null
          party_id: string
          preferred_unit_ids: string[] | null
          revisit_at: string | null
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "opportunities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_party: {
        Args: {
          _city?: string
          _email?: string
          _id_number?: string
          _id_type?: string
          _name_ar: string
          _name_en?: string
          _party_type?: Database["public"]["Enums"]["party_type"]
          _phone?: string
          _source?: string
        }
        Returns: Json
      }
      create_telegram_link_token: { Args: never; Returns: string }
      crm_backfill_parties: { Args: never; Returns: Json }
      crm_ensure_party: {
        Args: {
          _email: string
          _id_number: string
          _id_type: string
          _name: string
          _phone: string
          _source: string
        }
        Returns: string
      }
      enable_finance_cutover: { Args: { _reason: string }; Returns: undefined }
      ensure_tenant_account_for_tenant: {
        Args: { _tenant_id: string }
        Returns: string
      }
      expire_pending_bookings: { Args: never; Returns: number }
      extend_booking_expiry: {
        Args: { _booking_id: string; _hours: number }
        Returns: string
      }
      extend_booking_hold: {
        Args: { _booking_id: string; _reason: string }
        Returns: string
      }
      finance_assert_writer: { Args: never; Returns: undefined }
      finance_audit: {
        Args: {
          _action: string
          _after: Json
          _before: Json
          _id: string
          _reason: string
          _table: string
        }
        Returns: undefined
      }
      finance_can_read: { Args: never; Returns: boolean }
      finance_regression_tests: { Args: never; Returns: Json }
      finance_safety_regression_tests: { Args: never; Returns: Json }
      find_tenant_by_cr: {
        Args: { _cr: string }
        Returns: {
          business_name: string
          email: string
          full_name: string
          id: string
          phone: string
        }[]
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
      get_maintenance_status: {
        Args: never
        Returns: {
          maintenance_message: string
          maintenance_mode: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_leads: { Args: { _rows: Json }; Returns: number }
      initialize_unit_leasing_status: {
        Args: {
          _reason: string
          _status: Database["public"]["Enums"]["unit_leasing_status"]
          _unit_id: string
        }
        Returns: undefined
      }
      leasing_manager_bookings: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: Json
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
      log_opportunity_activity: {
        Args: {
          _activity_type: Database["public"]["Enums"]["opportunity_activity_type"]
          _next_action?: string
          _next_action_at?: string
          _notes?: string
          _opportunity_id: string
          _outcome: Database["public"]["Enums"]["opportunity_activity_outcome"]
        }
        Returns: {
          activity_id: string | null
          area_needed_m2: number | null
          booking_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_to: string | null
          next_action: string | null
          next_action_at: string | null
          no_answer_attempts: number
          notes: string | null
          outcome: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason: string | null
          owner_user_id: string | null
          party_id: string
          preferred_unit_ids: string[] | null
          revisit_at: string | null
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "opportunities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lookup_login_email: { Args: { _identifier: string }; Returns: string }
      mark_booking_whatsapp_sent: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      merge_duplicate_tenant_accounts: {
        Args: never
        Returns: {
          deleted_accounts: number
          merged_groups: number
        }[]
      }
      move_opportunity: {
        Args: {
          _lost_to?: string
          _opportunity_id: string
          _outcome?: Database["public"]["Enums"]["opportunity_outcome"]
          _outcome_reason?: string
          _reason: string
          _revisit_at?: string
          _to_stage: Database["public"]["Enums"]["opportunity_stage"]
        }
        Returns: {
          activity_id: string | null
          area_needed_m2: number | null
          booking_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          lost_to: string | null
          next_action: string | null
          next_action_at: string | null
          no_answer_attempts: number
          notes: string | null
          outcome: Database["public"]["Enums"]["opportunity_outcome"] | null
          outcome_reason: string | null
          owner_user_id: string | null
          party_id: string
          preferred_unit_ids: string[] | null
          revisit_at: string | null
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "opportunities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_invoice_number: { Args: never; Returns: string }
      next_offer_number: { Args: { _booking_id?: string }; Returns: string }
      publish_unit: {
        Args: { _reason: string; _state: string; _unit_id: string }
        Returns: string
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
      record_receipt: {
        Args: { _data: Json; _reason: string }
        Returns: string
      }
      refresh_installments: { Args: { _contract?: string }; Returns: undefined }
      register_unit_contract: {
        Args: {
          _booking_id: string
          _ends_on: string
          _number: string
          _reason: string
          _starts_on: string
          _tenant_account_id: string
          _unit_id: string
        }
        Returns: string
      }
      remove_booking_units: {
        Args: {
          _booking_id: string
          _booking_unit_ids: string[]
          _reason: string
        }
        Returns: Json
      }
      reopen_due_postponed: { Args: never; Returns: number }
      request_admin_export: {
        Args: { _format: string; _list: string; _scope: Json }
        Returns: string
      }
      request_transfer: {
        Args: { _opportunity_id: string; _reason: string }
        Returns: {
          created_at: string
          current_owner: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          opportunity_id: string
          reason: string
          requested_by: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "transfer_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_legacy_receipt: {
        Args: { _reason: string; _resolution: string; _source: string }
        Returns: undefined
      }
      resolve_legacy_receipt_link: {
        Args: {
          _canonical: string
          _reason: string
          _resolution: string
          _source: string
        }
        Returns: undefined
      }
      reverse_collection: {
        Args: { _collection_id: string; _reason: string }
        Returns: string
      }
      reverse_payment: {
        Args: { _invoice_id: string; _reason: string }
        Returns: string
      }
      reverse_receipt: {
        Args: { _id: string; _reason: string }
        Returns: string
      }
      save_admin_list_preferences: {
        Args: { _list: string; _name: string; _settings: Json }
        Returns: string
      }
      save_payment_plan: {
        Args: {
          _count: number
          _day: number
          _id: string
          _interval: number
          _name: string
          _reason: string
        }
        Returns: string
      }
      set_booking_paid_amount: {
        Args: { _booking_id: string; _paid_amount: number }
        Returns: undefined
      }
      set_contract_state: {
        Args: { _id: string; _reason: string; _status: string }
        Returns: undefined
      }
      set_tenant_account_paid_amount: {
        Args: { _paid_amount: number; _tenant_account_id: string }
        Returns: undefined
      }
      set_unit_contract_state: {
        Args: { _contract_id: string; _reason: string; _status: string }
        Returns: undefined
      }
      set_unit_status: {
        Args: {
          new_status: Database["public"]["Enums"]["unit_leasing_status"]
          reason: string
          ref_id?: string
          ref_type: string
          unit_id: string
        }
        Returns: undefined
      }
      sync_all_rented_units_to_accounts: { Args: never; Returns: number }
      telegram_unit_status_action: {
        Args: { _action: string; _actor: string; _args: Json }
        Returns: Json
      }
      touch_api_key: { Args: { _id: string }; Returns: undefined }
      unarchive_record: {
        Args: { _id: string; _reason: string; _table: string }
        Returns: undefined
      }
      unit_import_apply: {
        Args: { _file_name: string; _reason: string; _rows: Json }
        Returns: Json
      }
      unit_import_preview: { Args: { _rows: Json }; Returns: Json }
      unit_status_regression_tests: { Args: never; Returns: Json }
      unlink_my_telegram: { Args: { _chat_id: number }; Returns: undefined }
      update_draft_contract: {
        Args: { _data: Json; _id: string; _reason: string }
        Returns: undefined
      }
      validate_identity: {
        Args: { _id_type: string; _number: string }
        Returns: boolean
      }
      verify_api_key: {
        Args: { _key_hash: string }
        Returns: {
          id: string
          is_valid: boolean
          scopes: string[]
        }[]
      }
      verify_receipt: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      verify_unit_first_payment: {
        Args: {
          _contract_id: string
          _reason: string
          _receipt_id: string
          _receipt_type: string
        }
        Returns: string
      }
      waive_installment: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "control"
        | "manager"
        | "tenant"
        | "leasing_manager"
        | "sales_agent"
        | "accountant"
      opportunity_activity_outcome: "answered" | "no_answer" | "follow_up"
      opportunity_activity_type:
        | "call"
        | "whatsapp"
        | "visit"
        | "meeting"
        | "note"
      opportunity_outcome:
        | "no_answer"
        | "not_interested"
        | "not_suitable"
        | "chose_other"
        | "duplicate"
      opportunity_source:
        | "platform"
        | "target_list"
        | "whatsapp"
        | "call"
        | "referral"
        | "campaign"
        | "walk_in"
        | "agent"
      opportunity_stage:
        | "new"
        | "contacted"
        | "qualified"
        | "offer_sent"
        | "booking_request"
        | "on_hold"
        | "pending_contract"
        | "won"
        | "postponed"
        | "waitlist"
      party_type: "company" | "individual"
      tenant_lifecycle:
        | "active"
        | "renewal_due"
        | "renewed"
        | "ended"
        | "terminated"
      unit_leasing_status:
        | "available"
        | "on_hold"
        | "pending_contract"
        | "leased"
        | "maintenance"
        | "blocked"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "user",
        "control",
        "manager",
        "tenant",
        "leasing_manager",
        "sales_agent",
        "accountant",
      ],
      opportunity_activity_outcome: ["answered", "no_answer", "follow_up"],
      opportunity_activity_type: [
        "call",
        "whatsapp",
        "visit",
        "meeting",
        "note",
      ],
      opportunity_outcome: [
        "no_answer",
        "not_interested",
        "not_suitable",
        "chose_other",
        "duplicate",
      ],
      opportunity_source: [
        "platform",
        "target_list",
        "whatsapp",
        "call",
        "referral",
        "campaign",
        "walk_in",
        "agent",
      ],
      opportunity_stage: [
        "new",
        "contacted",
        "qualified",
        "offer_sent",
        "booking_request",
        "on_hold",
        "pending_contract",
        "won",
        "postponed",
        "waitlist",
      ],
      party_type: ["company", "individual"],
      tenant_lifecycle: [
        "active",
        "renewal_due",
        "renewed",
        "ended",
        "terminated",
      ],
      unit_leasing_status: [
        "available",
        "on_hold",
        "pending_contract",
        "leased",
        "maintenance",
        "blocked",
      ],
    },
  },
} as const
