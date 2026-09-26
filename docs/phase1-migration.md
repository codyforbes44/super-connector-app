# Phase 1 workspace migration

Apply `supabase/migrations/20260926120000_phase1_workspaces.sql` to staging before production. Take a database backup first. The migration is additive until it rewrites row-level security.

## What it does

- Creates `workspaces`, `workspace_members`, `workspace_twilio`, `plan_limits`, `workspace_entitlements`, `number_assignees`, `phone_verifications`, and `activation_events`.
- Adds `workspace_id` to every tenant table listed in `src/lib/tenant-tables.ts`.
- Puts every existing row into the founding workspace `11111111-1111-4111-8111-111111111111` (slug `sixvox`).
- Makes every current platform `owner` and `super_admin` an owner of that workspace. Other roles become `admin` or `agent`. Profiles with no role become agents so their rows are not orphaned.
- Keeps the founding workspace on the parent Twilio account (`uses_parent_account = true`) and marks it A2P-grandfathered. Numbers are not moved until an owner runs **Move numbers** under Advanced.
- Assigns founding owners and admins to existing numbers so today's ring set stays the same. New purchases assign only the buyer.
- Replaces tenant RLS with membership checks. `super_admin` remains a platform role and can read across workspaces.
- Seeds plan caps. Later edits to `plan_limits` are kept (`ON CONFLICT DO NOTHING`).
- Raises founding entitlements to at least the current number and seat counts so existing usage is not locked out. If there is no active subscription, the founding plan defaults to Scale.
- Adds nullable `phone_numbers.e911_address_sid` and `workspaces.recording_consent_required` (default false) for the Phase 2 emergency-address and recording-consent work. The Secondary Customer Profile SID on `a2p_registrations` is the TrustHub bundle that later SHAKEN/CNAM registration reuses.

`20260927040000_phase1_backfill_sibling_workspace_id.sql` runs after the release-train migrations. Those PRs add a nullable `workspace_id` with no foreign key, and their timestamps are later than `20260926120000`, so the first migration skips the tables. The follow-up:

- Backfills `missed_call_textbacks`, `outbound_webhook_endpoints`, `outbound_webhook_deliveries`, `emergency_addresses`, `e911_acknowledgments`, `sms_opt_outs`, `sms_consent_log`, `sms_quiet_hours`, `ai_voice_consents`, `trust_hub_registrations`, `messaging_opt_out_prefs`, `integration_connections`, `review_settings`, `review_requests`, `consent_log`, `payment_links`, `port_in_requests`, `port_in_events`, and `trade_syncs`.
- Also backfills any other public table that already has `workspace_id` and is not in the Phase 1 list. That covers an AI receptionist table if its migration sorts before this file. No receptionist migration was on the remote when this was written.
- Points rows at the caller's workspace when `user_id` is set, then at the founding workspace. Text-backs and emergency addresses follow the phone number. Webhook deliveries follow their endpoint. Port-in events follow the request.
- Adds the foreign key, index, membership RLS, and `assign_workspace_id` trigger. `workspace_id` becomes NOT NULL only when no nulls remain.
- Backfills `leads.workspace_id` and adds the foreign key when that column exists. Leads stay nullable and keep the super-admin policies.
- Drops `voice_presence_user_id_uidx` when `voice_presence.device_key` exists, so the native-calling migration can keep one presence row per device.
- Leaves `integration_secrets`, `oauth_transactions`, `stripe_connect_events`, `port_in_private`, and `mobile_call_acks` alone. They have no `workspace_id`.

## Rollback

There is no down migration that restores the previous policies. If production must be rolled back:

1. Restore the database backup taken before the migration. That is the only way to get the old RLS policies back.
2. Redeploy the previous application build. The new server code expects `workspace_id`.

Dropping `workspace_id` without a backup leaves the rows in place but removes the tenant assignment, and the new policies will hide those rows from members.

## Owner actions after applying

- Confirm both existing owner profiles are owners of the SixVox workspace and can still see numbers, threads, and calls.
- Do not run **Move numbers** until a staging subaccount has been exercised. That action creates a subaccount and updates each number's Account SID. It is idempotent.
- Set the environment variables in `docs/staging.md` before a new customer completes onboarding or A2P.
- Create the ISV primary Business Profile in the Twilio console (business identity "ISV Reseller or Partner") and put its SID in `TWILIO_PRIMARY_CUSTOMER_PROFILE_SID`.
- Create a Twilio Verify service and set `TWILIO_VERIFY_SERVICE_SID`.
- Apply this migration on the staging Supabase project before production.
