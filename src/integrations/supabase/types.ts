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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      a2p_registrations: {
        Row: {
          address_sid: string | null
          brand_sid: string | null
          brand_status: string | null
          business: Json
          campaign_input: Json
          campaign_sid: string | null
          campaign_status: string | null
          created_at: string
          customer_profile_sid: string | null
          document_sid: string | null
          end_user_sid: string | null
          id: string
          last_error: string | null
          messaging_service_sid: string | null
          trust_product_sid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_sid?: string | null
          brand_sid?: string | null
          brand_status?: string | null
          business?: Json
          campaign_input?: Json
          campaign_sid?: string | null
          campaign_status?: string | null
          created_at?: string
          customer_profile_sid?: string | null
          document_sid?: string | null
          end_user_sid?: string | null
          id?: string
          last_error?: string | null
          messaging_service_sid?: string | null
          trust_product_sid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_sid?: string | null
          brand_sid?: string | null
          brand_status?: string | null
          business?: Json
          campaign_input?: Json
          campaign_sid?: string | null
          campaign_status?: string | null
          created_at?: string
          customer_profile_sid?: string | null
          document_sid?: string | null
          end_user_sid?: string | null
          id?: string
          last_error?: string | null
          messaging_service_sid?: string | null
          trust_product_sid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          agent_id: string | null
          app_number: string
          call_sid: string
          conversation_id: string | null
          created_at: string
          id: string
          summary: string | null
          transcript: Json
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          app_number: string
          call_sid: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          summary?: string | null
          transcript?: Json
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          app_number?: string
          call_sid?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          summary?: string | null
          transcript?: Json
          updated_at?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          scopes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          scopes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          scopes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: []
      }
      byo_numbers: {
        Row: {
          assigned_number: string | null
          carrier: string | null
          created_at: string
          forward_mode: string
          id: string
          last_forwarded_call_at: string | null
          personal_number: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          assigned_number?: string | null
          carrier?: string | null
          created_at?: string
          forward_mode?: string
          id?: string
          last_forwarded_call_at?: string | null
          personal_number: string
          status?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          assigned_number?: string | null
          carrier?: string | null
          created_at?: string
          forward_mode?: string
          id?: string
          last_forwarded_call_at?: string | null
          personal_number?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      calendar_bookings: {
        Row: {
          app_number: string
          calendar_id: string
          call_sid: string | null
          contact_email: string | null
          contact_number: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          event_id: string
          html_link: string | null
          id: string
          source: string
          starts_at: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          app_number: string
          calendar_id: string
          call_sid?: string | null
          contact_email?: string | null
          contact_number?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          event_id: string
          html_link?: string | null
          id?: string
          source?: string
          starts_at: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          app_number?: string
          calendar_id?: string
          call_sid?: string | null
          contact_email?: string | null
          contact_number?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          event_id?: string
          html_link?: string | null
          id?: string
          source?: string
          starts_at?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_bookings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_settings: {
        Row: {
          active_calendars: Json
          add_meet_link: boolean
          ai_event_status: string
          buffer_minutes: number
          created_at: string
          default_calendar_id: string | null
          default_duration_minutes: number
          event_title_template: string
          invite_contact: boolean
          lookahead_days: number
          lookback_days: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calendars?: Json
          add_meet_link?: boolean
          ai_event_status?: string
          buffer_minutes?: number
          created_at?: string
          default_calendar_id?: string | null
          default_duration_minutes?: number
          event_title_template?: string
          invite_contact?: boolean
          lookahead_days?: number
          lookback_days?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calendars?: Json
          add_meet_link?: boolean
          ai_event_status?: string
          buffer_minutes?: number
          created_at?: string
          default_calendar_id?: string | null
          default_duration_minutes?: number
          event_title_template?: string
          invite_contact?: boolean
          lookahead_days?: number
          lookback_days?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      caller_id_routes: {
        Row: {
          caller_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          pattern: string
          updated_at: string
        }
        Insert: {
          caller_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          pattern: string
          updated_at?: string
        }
        Update: {
          caller_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          pattern?: string
          updated_at?: string
        }
        Relationships: []
      }
      caller_id_verifications: {
        Row: {
          call_sid: string | null
          created_at: string
          error: string | null
          friendly_name: string | null
          id: string
          phone_number: string
          requested_by: string | null
          status: string
          updated_at: string
          validation_code: string | null
        }
        Insert: {
          call_sid?: string | null
          created_at?: string
          error?: string | null
          friendly_name?: string | null
          id?: string
          phone_number: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          validation_code?: string | null
        }
        Update: {
          call_sid?: string | null
          created_at?: string
          error?: string | null
          friendly_name?: string | null
          id?: string
          phone_number?: string
          requested_by?: string | null
          status?: string
          updated_at?: string
          validation_code?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          answer_path: string | null
          answered_by: string | null
          answered_in_app: boolean
          app_number: string
          client_identity: string | null
          created_at: string
          direction: string
          duration: number | null
          error_code: string | null
          from_number: string
          id: string
          price: string | null
          recording_url: string | null
          sid: string
          started_at: string
          status: string | null
          to_number: string
          transcription: string | null
        }
        Insert: {
          answer_path?: string | null
          answered_by?: string | null
          answered_in_app?: boolean
          app_number: string
          client_identity?: string | null
          created_at?: string
          direction: string
          duration?: number | null
          error_code?: string | null
          from_number: string
          id?: string
          price?: string | null
          recording_url?: string | null
          sid: string
          started_at?: string
          status?: string | null
          to_number: string
          transcription?: string | null
        }
        Update: {
          answer_path?: string | null
          answered_by?: string | null
          answered_in_app?: boolean
          app_number?: string
          client_identity?: string | null
          created_at?: string
          direction?: string
          duration?: number | null
          error_code?: string | null
          from_number?: string
          id?: string
          price?: string | null
          recording_url?: string | null
          sid?: string
          started_at?: string
          status?: string | null
          to_number?: string
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string | null
          notes: string | null
          outbound_caller_id: string | null
          owner_id: string | null
          phone_number: string
          place_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          notes?: string | null
          outbound_caller_id?: string | null
          owner_id?: string | null
          phone_number: string
          place_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          notes?: string | null
          outbound_caller_id?: string | null
          owner_id?: string | null
          phone_number?: string
          place_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          app_number: string
          archived: boolean
          assigned_to: string | null
          channel: string
          contact_name: string | null
          contact_number: string
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          unread_count: number
        }
        Insert: {
          app_number: string
          archived?: boolean
          assigned_to?: string | null
          channel?: string
          contact_name?: string | null
          contact_number: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          unread_count?: number
        }
        Update: {
          app_number?: string
          archived?: boolean
          assigned_to?: string | null
          channel?: string
          contact_name?: string | null
          contact_number?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          body_html: string | null
          bounced_at: string | null
          click_count: number
          clicked_at: string | null
          complained_at: string | null
          context: Json
          created_at: string
          delivered_at: string | null
          error: string | null
          from_address: string | null
          id: string
          last_click_url: string | null
          last_event_at: string | null
          open_count: number
          opened_at: string | null
          provider_id: string | null
          retry_of: string | null
          status: string
          subject: string
          template: string
          to_address: string
        }
        Insert: {
          body_html?: string | null
          bounced_at?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          context?: Json
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          from_address?: string | null
          id?: string
          last_click_url?: string | null
          last_event_at?: string | null
          open_count?: number
          opened_at?: string | null
          provider_id?: string | null
          retry_of?: string | null
          status?: string
          subject: string
          template: string
          to_address: string
        }
        Update: {
          body_html?: string | null
          bounced_at?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          context?: Json
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          from_address?: string | null
          id?: string
          last_click_url?: string | null
          last_event_at?: string | null
          open_count?: number
          opened_at?: string | null
          provider_id?: string | null
          retry_of?: string | null
          status?: string
          subject?: string
          template?: string
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_retry_of_fkey"
            columns: ["retry_of"]
            isOneToOne: false
            referencedRelation: "email_log"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          eyebrow: string | null
          headline: string | null
          intro: string | null
          outro: string | null
          subject: string | null
          template: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          eyebrow?: string | null
          headline?: string | null
          intro?: string | null
          outro?: string | null
          subject?: string | null
          template: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          eyebrow?: string | null
          headline?: string | null
          intro?: string | null
          outro?: string | null
          subject?: string | null
          template?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
          source: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
          source?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
          source?: string
        }
        Relationships: []
      }
      lookups: {
        Row: {
          created_at: string
          id: string
          looked_up_by: string | null
          phone_number: string
          result: Json
        }
        Insert: {
          created_at?: string
          id?: string
          looked_up_by?: string | null
          phone_number: string
          result?: Json
        }
        Update: {
          created_at?: string
          id?: string
          looked_up_by?: string | null
          phone_number?: string
          result?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lookups_looked_up_by_fkey"
            columns: ["looked_up_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          error_code: string | null
          from_number: string
          id: string
          is_internal_note: boolean
          media: Json
          price: string | null
          scheduled_for: string | null
          sent_by: string | null
          sid: string | null
          status: string | null
          to_number: string
        }
        Insert: {
          body?: string | null
          channel?: string
          conversation_id: string
          created_at?: string
          direction: string
          error_code?: string | null
          from_number: string
          id?: string
          is_internal_note?: boolean
          media?: Json
          price?: string | null
          scheduled_for?: string | null
          sent_by?: string | null
          sid?: string | null
          status?: string | null
          to_number: string
        }
        Update: {
          body?: string | null
          channel?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error_code?: string | null
          from_number?: string
          id?: string
          is_internal_note?: boolean
          media?: Json
          price?: string | null
          scheduled_for?: string | null
          sent_by?: string | null
          sid?: string | null
          status?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          created_at: string
          digest_mode: string
          email_account: boolean
          email_address: string | null
          email_ai_summary: boolean
          email_daily_digest: boolean
          email_inbound_message: boolean
          email_missed_call: boolean
          email_voicemail: boolean
          quiet_end: string
          quiet_hours_enabled: boolean
          quiet_start: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_mode?: string
          email_account?: boolean
          email_address?: string | null
          email_ai_summary?: boolean
          email_daily_digest?: boolean
          email_inbound_message?: boolean
          email_missed_call?: boolean
          email_voicemail?: boolean
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_mode?: string
          email_account?: boolean
          email_address?: string | null
          email_ai_summary?: boolean
          email_daily_digest?: boolean
          email_inbound_message?: boolean
          email_missed_call?: boolean
          email_voicemail?: boolean
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          ai_fallback: string
          ai_fallback_number: string | null
          ai_first_message: string | null
          ai_language: string
          ai_max_duration: number
          ai_prompt: string | null
          ai_tone: string
          answer_mode: string
          assigned_to: string | null
          booking_buffer_minutes: number
          booking_enabled: boolean
          booking_hours: Json
          booking_slot_minutes: number
          booking_timezone: string
          calendar_id: string | null
          capabilities: Json
          channel_whatsapp: boolean
          created_at: string
          elevenlabs_agent_id: string | null
          elevenlabs_phone_number_id: string | null
          elevenlabs_voice_id: string | null
          forward_to: string | null
          friendly_name: string | null
          greeting_audio_path: string | null
          id: string
          outbound_caller_id: string | null
          phone_number: string
          sid: string
          voicemail_greeting: string | null
          webhook_wired: boolean
        }
        Insert: {
          ai_fallback?: string
          ai_fallback_number?: string | null
          ai_first_message?: string | null
          ai_language?: string
          ai_max_duration?: number
          ai_prompt?: string | null
          ai_tone?: string
          answer_mode?: string
          assigned_to?: string | null
          booking_buffer_minutes?: number
          booking_enabled?: boolean
          booking_hours?: Json
          booking_slot_minutes?: number
          booking_timezone?: string
          calendar_id?: string | null
          capabilities?: Json
          channel_whatsapp?: boolean
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_phone_number_id?: string | null
          elevenlabs_voice_id?: string | null
          forward_to?: string | null
          friendly_name?: string | null
          greeting_audio_path?: string | null
          id?: string
          outbound_caller_id?: string | null
          phone_number: string
          sid: string
          voicemail_greeting?: string | null
          webhook_wired?: boolean
        }
        Update: {
          ai_fallback?: string
          ai_fallback_number?: string | null
          ai_first_message?: string | null
          ai_language?: string
          ai_max_duration?: number
          ai_prompt?: string | null
          ai_tone?: string
          answer_mode?: string
          assigned_to?: string | null
          booking_buffer_minutes?: number
          booking_enabled?: boolean
          booking_hours?: Json
          booking_slot_minutes?: number
          booking_timezone?: string
          calendar_id?: string | null
          capabilities?: Json
          channel_whatsapp?: boolean
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_phone_number_id?: string | null
          elevenlabs_voice_id?: string | null
          forward_to?: string | null
          friendly_name?: string | null
          greeting_audio_path?: string | null
          id?: string
          outbound_caller_id?: string | null
          phone_number?: string
          sid?: string
          voicemail_greeting?: string | null
          webhook_wired?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          features: Json
          highlighted: boolean
          included_numbers: number
          included_seats: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          features?: Json
          highlighted?: boolean
          included_numbers?: number
          included_seats?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          features?: Json
          highlighted?: boolean
          included_numbers?: number
          included_seats?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_phone: string | null
          avatar_url: string | null
          created_at: string
          default_number: string | null
          display_name: string | null
          email: string | null
          id: string
          onboarding_completed: boolean
          onboarding_skipped: boolean
          onboarding_state: Json
          onboarding_step: number
          setup_state: Json
          support_requested_at: string | null
          workspace_name: string | null
        }
        Insert: {
          agent_phone?: string | null
          avatar_url?: string | null
          created_at?: string
          default_number?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          onboarding_completed?: boolean
          onboarding_skipped?: boolean
          onboarding_state?: Json
          onboarding_step?: number
          setup_state?: Json
          support_requested_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          agent_phone?: string | null
          avatar_url?: string | null
          created_at?: string
          default_number?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          onboarding_completed?: boolean
          onboarding_skipped?: boolean
          onboarding_state?: Json
          onboarding_step?: number
          setup_state?: Json
          support_requested_at?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          address: string
          created_at: string
          id: string
          label: string
          lat: number | null
          lng: number | null
          name: string | null
          nickname: string
          notes: string | null
          phone: string | null
          place_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          nickname: string
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          name?: string | null
          nickname?: string
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancel_at_period_end: boolean
          comped: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          plan_code: string | null
          price_id: string | null
          product_id: string | null
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspended: boolean
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string
          cancel_at_period_end?: boolean
          comped?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_code?: string | null
          price_id?: string | null
          product_id?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string
          cancel_at_period_end?: boolean
          comped?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_code?: string | null
          price_id?: string | null
          product_id?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspended?: boolean
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      twiml_apps: {
        Row: {
          created_at: string
          friendly_name: string
          id: string
          is_default: boolean
          sid: string
          sms_url: string | null
          updated_at: string
          voice_url: string | null
        }
        Insert: {
          created_at?: string
          friendly_name: string
          id?: string
          is_default?: boolean
          sid: string
          sms_url?: string | null
          updated_at?: string
          voice_url?: string | null
        }
        Update: {
          created_at?: string
          friendly_name?: string
          id?: string
          is_default?: boolean
          sid?: string
          sms_url?: string | null
          updated_at?: string
          voice_url?: string | null
        }
        Relationships: []
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
      voice_presence: {
        Row: {
          created_at: string
          identity: string
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          identity: string
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          identity?: string
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_number: {
        Args: { _number: string; _user_id: string }
        Returns: boolean
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "agent" | "super_admin"
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
      app_role: ["owner", "admin", "agent", "super_admin"],
    },
  },
} as const
