/**
 * Customer data that must carry workspace_id and membership RLS.
 * Platform tables (profiles, user_roles, plans, marketing leads, public
 * concierge chats) stay global. Keep this list in sync with the Phase 1
 * migration's TENANT_TABLES array.
 */
export const TENANT_TABLES = [
  "phone_numbers",
  "calls",
  "messages",
  "conversations",
  "contacts",
  "call_transcripts",
  "call_intelligence",
  "contact_memory",
  "caller_rules",
  "caller_id_verifications",
  "caller_id_routes",
  "voice_presence",
  "push_subscriptions",
  "a2p_registrations",
  "byo_numbers",
  "subscriptions",
  "audit_log",
  "templates",
  "lookups",
  "ai_conversations",
  "twiml_apps",
  "saved_places",
  "place_searches",
  "calendar_settings",
  "calendar_bookings",
  "app_user_connections",
  "notification_prefs",
  "email_log",
  "email_template_overrides",
  "digest_queue",
  "webhook_errors",
  "esim_orders",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];
