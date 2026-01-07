export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          client_name: string
          clinic_id: string
          created_at: string | null
          id: string
          last_message: string | null
          last_message_time: string | null
          lead_id: string | null
          phone_number: string
          status: string
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_name: string
          clinic_id: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          lead_id?: string | null
          phone_number: string
          status?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_name?: string
          clinic_id?: string
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          lead_id?: string | null
          phone_number?: string
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
            foreignKeyName: "chats_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
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
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          stage: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          clinic_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          stage?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          clinic_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          stage?: string
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
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string | null
          id: string
          is_from_client: boolean
          media_url: string | null
          read_at: string | null
          sent_by: string | null
          type: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string | null
          id?: string
          is_from_client?: boolean
          media_url?: string | null
          read_at?: string | null
          sent_by?: string | null
          type?: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_from_client?: boolean
          media_url?: string | null
          read_at?: string | null
          sent_by?: string | null
          type?: string
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
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
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
          clinic_id: string
          created_at: string | null
          email: string
          id: string
          name: string
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          clinic_id: string
          created_at?: string | null
          email: string
          id: string
          name: string
          role: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          clinic_id?: string
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_key: string | null
          clinic_id: string
          connected_at: string | null
          created_at: string | null
          id: string
          instance_name: string
          phone_number: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          clinic_id: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_name: string
          phone_number?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          clinic_id?: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_name?: string
          phone_number?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: number
          evolution_api_url: string | null
          evolution_api_key: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          evolution_api_url?: string | null
          evolution_api_key?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          evolution_api_url?: string | null
          evolution_api_key?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_clinic_id: { Args: Record<string, never>; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof PublicSchema["Tables"]
> = PublicSchema["Tables"][TableName]["Update"]
