/**
 * Customer data that must carry workspace_id and membership RLS.
 * Platform tables (profiles, user_roles, plans, marketing leads, public
 * concierge chats) stay global. Keep this list in sync with the Phase 1
 * migration and scripts/tenant-isolation.sql.
 *
 * Tables after esim_orders come from the release-train PRs. Those migrations
 * add a nullable workspace_id with no foreign key. The live database recorded
 * the workspace migration as 20260926101804 and the sibling backfill as
 * 20260926102207, which is what fills them in. Secrets tables with no workspace_id
 * (integration_secrets, oauth_transactions, stripe_connect_events,
 * port_in_private, mobile_call_acks) stay server-only.
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
  "missed_call_textbacks",
  "outbound_webhook_endpoints",
  "outbound_webhook_deliveries",
  "emergency_addresses",
  "e911_acknowledgments",
  "sms_opt_outs",
  "sms_consent_log",
  "sms_quiet_hours",
  "ai_voice_consents",
  "trust_hub_registrations",
  "messaging_opt_out_prefs",
  "integration_connections",
  "review_settings",
  "review_requests",
  "consent_log",
  "payment_links",
  "port_in_requests",
  "port_in_events",
  "trade_syncs",
  "booking_proposals",
  "caller_lists",
  "caller_line_cache",
] as const;

export type TenantTable = (typeof TENANT_TABLES)[number];
