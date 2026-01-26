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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_access_logs: {
        Row: {
          action: string
          clinic_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          super_admin_id: string
        }
        Insert: {
          action: string
          clinic_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id: string
        }
        Update: {
          action?: string
          clinic_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          super_admin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_access_logs_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notes: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tags: {
        Row: {
          chat_id: string
          tag_id: string
        }
        Insert: {
          chat_id: string
          tag_id: string
        }
        Update: {
          chat_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tags_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          channel: string | null
          client_name: string
          clinic_id: string
          created_at: string | null
          group_id: string | null
          id: string
          instance_id: string | null
          is_group: boolean | null
          is_pinned: boolean | null
          last_message: string | null
          last_message_from_client: boolean | null
          last_message_time: string | null
          lead_id: string | null
          locked_at: string | null
          locked_by: string | null
          phone_number: string
          source_id: string | null
          status: string
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          channel?: string | null
          client_name: string
          clinic_id: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          is_pinned?: boolean | null
          last_message?: string | null
          last_message_from_client?: boolean | null
          last_message_time?: string | null
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          phone_number: string
          source_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          channel?: string | null
          client_name?: string
          clinic_id?: string
          created_at?: string | null
          group_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          is_pinned?: boolean | null
          last_message?: string | null
          last_message_from_client?: boolean | null
          last_message_time?: string | null
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          phone_number?: string
          source_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_receipts: {
        Row: {
          chat_id: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          payment_id: string | null
          receipt_date: string
          total_value: number
          updated_at: string | null
        }
        Insert: {
          chat_id: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_id?: string | null
          receipt_date?: string
          total_value: number
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          payment_id?: string | null
          receipt_date?: string
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_receipts_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_receipts_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          can_create_users: boolean | null
          cloud_api_access_token: string | null
          cloud_api_app_id: string | null
          cloud_api_enabled: boolean | null
          cloud_api_phone_number_id: string | null
          cloud_api_verify_token: string | null
          cloud_api_waba_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          facebook_access_token: string | null
          facebook_api_token: string | null
          facebook_client_can_configure: boolean | null
          facebook_dataset_id: string | null
          facebook_enabled: boolean | null
          facebook_page_id: string | null
          id: string
          instagram_access_token: string | null
          instagram_client_can_configure: boolean | null
          instagram_enabled: boolean | null
          instagram_page_id: string | null
          logo_url: string | null
          max_users: number | null
          monthly_goal: number | null
          name: string
          phone: string | null
          plan: string | null
          slug: string
          status: string | null
          support_enabled: boolean | null
          updated_at: string | null
          whatsapp_provider: string | null
        }
        Insert: {
          address?: string | null
          can_create_users?: boolean | null
          cloud_api_access_token?: string | null
          cloud_api_app_id?: string | null
          cloud_api_enabled?: boolean | null
          cloud_api_phone_number_id?: string | null
          cloud_api_verify_token?: string | null
          cloud_api_waba_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          facebook_access_token?: string | null
          facebook_api_token?: string | null
          facebook_client_can_configure?: boolean | null
          facebook_dataset_id?: string | null
          facebook_enabled?: boolean | null
          facebook_page_id?: string | null
          id?: string
          instagram_access_token?: string | null
          instagram_client_can_configure?: boolean | null
          instagram_enabled?: boolean | null
          instagram_page_id?: string | null
          logo_url?: string | null
          max_users?: number | null
          monthly_goal?: number | null
          name: string
          phone?: string | null
          plan?: string | null
          slug: string
          status?: string | null
          support_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_provider?: string | null
        }
        Update: {
          address?: string | null
          can_create_users?: boolean | null
          cloud_api_access_token?: string | null
          cloud_api_app_id?: string | null
          cloud_api_enabled?: boolean | null
          cloud_api_phone_number_id?: string | null
          cloud_api_verify_token?: string | null
          cloud_api_waba_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          facebook_access_token?: string | null
          facebook_api_token?: string | null
          facebook_client_can_configure?: boolean | null
          facebook_dataset_id?: string | null
          facebook_enabled?: boolean | null
          facebook_page_id?: string | null
          id?: string
          instagram_access_token?: string | null
          instagram_client_can_configure?: boolean | null
          instagram_enabled?: boolean | null
          instagram_page_id?: string | null
          logo_url?: string | null
          max_users?: number | null
          monthly_goal?: number | null
          name?: string
          phone?: string | null
          plan?: string | null
          slug?: string
          status?: string | null
          support_enabled?: boolean | null
          updated_at?: string | null
          whatsapp_provider?: string | null
        }
        Relationships: []
      }
      lead_sources: {
        Row: {
          clinic_id: string
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          lead_id: string
          tag_id: string
        }
        Insert: {
          lead_id: string
          tag_id: string
        }
        Update: {
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          clinic_id: string
          converted_at: string | null
          converted_value: number | null
          created_at: string | null
          email: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          name: string
          notes: string | null
          phone: string
          source_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          converted_at?: string | null
          converted_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          notes?: string | null
          phone: string
          source_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          converted_at?: string | null
          converted_value?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          notes?: string | null
          phone?: string
          source_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_message_campaigns: {
        Row: {
          clinic_id: string
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          instance_id: string | null
          message_content: string | null
          name: string
          read_count: number | null
          sent_count: number | null
          status: string | null
          target_count: number | null
          template_id: string | null
          template_name: string | null
          template_params: Json | null
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          message_content?: string | null
          name: string
          read_count?: number | null
          sent_count?: number | null
          status?: string | null
          target_count?: number | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          message_content?: string | null
          name?: string
          read_count?: number | null
          sent_count?: number | null
          status?: string | null
          target_count?: number | null
          template_id?: string | null
          template_name?: string | null
          template_params?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mass_message_campaigns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_message_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_message_campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_message_recipients: {
        Row: {
          campaign_id: string
          chat_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          phone_number: string
          read_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          chat_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          phone_number: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          chat_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          phone_number?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mass_message_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mass_message_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_message_recipients_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string | null
          delivered_at: string | null
          from_me: boolean
          id: string
          media_caption: string | null
          media_duration: number | null
          media_filename: string | null
          media_mimetype: string | null
          media_thumbnail: string | null
          media_url: string | null
          message_type: string
          quoted_message_id: string | null
          read_at: string | null
          remote_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          status: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          from_me?: boolean
          id?: string
          media_caption?: string | null
          media_duration?: number | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_thumbnail?: string | null
          media_url?: string | null
          message_type?: string
          quoted_message_id?: string | null
          read_at?: string | null
          remote_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string | null
          delivered_at?: string | null
          from_me?: boolean
          id?: string
          media_caption?: string | null
          media_duration?: number | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_thumbnail?: string | null
          media_url?: string | null
          message_type?: string
          quoted_message_id?: string | null
          read_at?: string | null
          remote_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          chat_id: string
          clinic_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          updated_at: string | null
          value: number
        }
        Insert: {
          chat_id: string
          clinic_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          updated_at?: string | null
          value: number
        }
        Update: {
          chat_id?: string
          clinic_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          has_api_access: boolean | null
          has_cloud_api: boolean | null
          has_facebook: boolean | null
          has_instagram: boolean | null
          has_mass_messaging: boolean | null
          has_priority_support: boolean | null
          has_reports: boolean | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          max_messages_month: number | null
          max_users: number | null
          max_whatsapp_instances: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          slug: string
          sort_order: number | null
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          has_api_access?: boolean | null
          has_cloud_api?: boolean | null
          has_facebook?: boolean | null
          has_instagram?: boolean | null
          has_mass_messaging?: boolean | null
          has_priority_support?: boolean | null
          has_reports?: boolean | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_messages_month?: number | null
          max_users?: number | null
          max_whatsapp_instances?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug: string
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          has_api_access?: boolean | null
          has_cloud_api?: boolean | null
          has_facebook?: boolean | null
          has_instagram?: boolean | null
          has_mass_messaging?: boolean | null
          has_priority_support?: boolean | null
          has_reports?: boolean | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_messages_month?: number | null
          max_users?: number | null
          max_whatsapp_instances?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          slug?: string
          sort_order?: number | null
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quick_replies: {
        Row: {
          clinic_id: string
          content: string
          created_at: string | null
          id: string
          shortcut: string
          title: string
          updated_at: string | null
        }
        Insert: {
          clinic_id: string
          content: string
          created_at?: string | null
          id?: string
          shortcut: string
          title: string
          updated_at?: string | null
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string | null
          id?: string
          shortcut?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          support_enabled: boolean | null
          support_online: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          support_enabled?: boolean | null
          support_online?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          support_enabled?: boolean | null
          support_online?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_invoices: {
        Row: {
          amount: number
          asaas_invoice_url: string | null
          asaas_payment_id: string | null
          clinic_id: string | null
          created_at: string | null
          description: string | null
          discount: number | null
          due_date: string
          id: string
          paid_at: string | null
          reference_month: string | null
          status: string | null
          subscription_id: string | null
          total: number
        }
        Insert: {
          amount: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          discount?: number | null
          due_date: string
          id?: string
          paid_at?: string | null
          reference_month?: string | null
          status?: string | null
          subscription_id?: string | null
          total: number
        }
        Update: {
          amount?: number
          asaas_invoice_url?: string | null
          asaas_payment_id?: string | null
          clinic_id?: string | null
          created_at?: string | null
          description?: string | null
          discount?: number | null
          due_date?: string
          id?: string
          paid_at?: string | null
          reference_month?: string | null
          status?: string | null
          subscription_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          clinic_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          payment_method: string | null
          plan_id: string | null
          starts_at: string | null
          status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id?: string | null
          starts_at?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          clinic_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id?: string | null
          starts_at?: string | null
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_from_support: boolean | null
          read_at: string | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_from_support?: boolean | null
          read_at?: string | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_from_support?: boolean | null
          read_at?: string | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_quick_replies: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          shortcut: string | null
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          clinic_id: string
          created_at: string | null
          id: string
          is_live_chat: boolean | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          clinic_id: string
          created_at?: string | null
          id?: string
          is_live_chat?: boolean | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          clinic_id?: string
          created_at?: string | null
          id?: string
          is_live_chat?: boolean | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          clinic_id: string
          color: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          can_see_goal: boolean | null
          clinic_id: string | null
          created_at: string | null
          default_instance_id: string | null
          email: string
          id: string
          monthly_goal: number | null
          name: string
          role: string
          status: string
          updated_at: string | null
          view_mode: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_see_goal?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          default_instance_id?: string | null
          email: string
          id: string
          monthly_goal?: number | null
          name: string
          role?: string
          status?: string
          updated_at?: string | null
          view_mode?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_see_goal?: boolean | null
          clinic_id?: string | null
          created_at?: string | null
          default_instance_id?: string | null
          email?: string
          id?: string
          monthly_goal?: number | null
          name?: string
          role?: string
          status?: string
          updated_at?: string | null
          view_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_default_instance_id_fkey"
            columns: ["default_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_debug: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          api_key: string | null
          clinic_id: string
          cloud_phone_number_id: string | null
          cloud_waba_id: string | null
          connected_at: string | null
          created_at: string | null
          display_name: string | null
          id: string
          instance_name: string
          is_shared: boolean | null
          phone_number: string | null
          provider: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          api_key?: string | null
          clinic_id: string
          cloud_phone_number_id?: string | null
          cloud_waba_id?: string | null
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name: string
          is_shared?: boolean | null
          phone_number?: string | null
          provider?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          api_key?: string | null
          clinic_id?: string
          cloud_phone_number_id?: string | null
          cloud_waba_id?: string | null
          connected_at?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string
          is_shared?: boolean | null
          phone_number?: string | null
          provider?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          category: string
          clinic_id: string
          components: Json | null
          created_at: string | null
          example: Json | null
          id: string
          language: string
          name: string
          status: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          category: string
          clinic_id: string
          components?: Json | null
          created_at?: string | null
          example?: Json | null
          id?: string
          language?: string
          name: string
          status?: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          clinic_id?: string
          components?: Json | null
          created_at?: string | null
          example?: Json | null
          id?: string
          language?: string
          name?: string
          status?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_clinic_id: { Args: never; Returns: string }
      get_user_clinic_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
