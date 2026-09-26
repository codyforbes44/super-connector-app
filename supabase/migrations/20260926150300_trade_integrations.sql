-- Phase 4 integrations: Jobber, Housecall Pro, review requests, Stripe Connect
-- payment links, and Twilio port-in. workspace_id is nullable until Phase 1
-- adds workspaces. Do not add a foreign key yet.
--
-- Rollback (run in order):
--   drop table if exists public.stripe_connect_events;
--   drop table if exists public.payment_links;
--   drop table if exists public.port_in_events;
--   drop table if exists public.port_in_private;
--   drop table if exists public.port_in_requests;
--   drop table if exists public.consent_log;
--   drop table if exists public.review_requests;
--   drop table if exists public.review_settings;
--   drop table if exists public.oauth_transactions;
--   drop table if exists public.integration_secrets;
--   drop table if exists public.integration_connections;
--   drop table if exists public.trade_syncs;
--   alter table public.messages drop column if exists workspace_id;
--   alter table public.leads drop column if exists workspace_id;
--   alter table public.leads drop column if exists conversation_id;
--   alter table public.leads drop column if exists job_done_at;
--   alter table public.leads drop column if exists job_status;
--   alter table public.leads drop column if exists phone_number;
--   alter table public.conversations drop column if exists workspace_id;
--   alter table public.conversations drop column if exists job_done_at;
--   alter table public.conversations drop column if exists job_status;
--   alter table public.contacts drop column if exists workspace_id;

alter table public.contacts add column if not exists workspace_id uuid;
alter table public.conversations add column if not exists workspace_id uuid;
alter table public.conversations add column if not exists job_status text;
alter table public.conversations add column if not exists job_done_at timestamptz;
alter table public.leads add column if not exists workspace_id uuid;
alter table public.leads add column if not exists phone_number text;
alter table public.leads add column if not exists job_status text;
alter table public.leads add column if not exists job_done_at timestamptz;
alter table public.leads add column if not exists conversation_id uuid;
alter table public.messages add column if not exists workspace_id uuid;

create index if not exists contacts_workspace_idx on public.contacts (workspace_id);
create index if not exists conversations_workspace_idx on public.conversations (workspace_id);
create index if not exists leads_workspace_idx on public.leads (workspace_id);
create index if not exists messages_workspace_idx on public.messages (workspace_id);

-- Connection status is readable by the signed-in user. Tokens and API keys
-- live in integration_secrets, which authenticated roles cannot select.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  provider text not null check (provider in ('jobber', 'housecall_pro', 'stripe_connect')),
  status text not null default 'disconnected',
  external_account_id text,
  account_label text,
  token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.integration_secrets (
  connection_id uuid primary key references public.integration_connections (id) on delete cascade,
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  api_key_ciphertext text,
  updated_at timestamptz not null default now()
);

create table if not exists public.oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  state text not null unique,
  code_verifier_ciphertext text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workspace_id uuid,
  google_review_url text,
  business_name text,
  enabled boolean not null default false,
  cooldown_days integer not null default 90,
  quiet_start text not null default '21:00',
  quiet_end text not null default '08:00',
  timezone text not null default 'America/Chicago',
  updated_at timestamptz not null default now()
);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  conversation_id uuid,
  lead_id uuid,
  contact_number text not null,
  status text not null,
  reason text,
  message_sid text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists review_requests_one_sent_per_conversation
  on public.review_requests (conversation_id)
  where status = 'sent' and conversation_id is not null;

create unique index if not exists review_requests_one_sent_per_lead
  on public.review_requests (lead_id)
  where status = 'sent' and lead_id is not null;

create index if not exists review_requests_contact_sent_idx
  on public.review_requests (user_id, contact_number, sent_at desc);

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  contact_number text not null,
  purpose text not null,
  action text not null,
  source text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  conversation_id uuid,
  connected_account_id text not null,
  checkout_session_id text,
  amount_cents integer not null,
  currency text not null default 'usd',
  description text not null,
  url text,
  status text not null default 'created',
  message_sid text,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_connect_events (
  event_id text primary key,
  payment_link_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.port_in_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  phone_number text not null,
  status text not null default 'draft',
  twilio_port_sid text,
  account_last4 text,
  customer_name text,
  notification_email text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.port_in_private (
  port_in_request_id uuid primary key references public.port_in_requests (id) on delete cascade,
  loa_ciphertext text not null,
  bill_ciphertext text not null,
  bill_filename text not null,
  bill_mime text not null,
  twilio_document_sid text
);

create table if not exists public.port_in_events (
  id uuid primary key default gen_random_uuid(),
  port_in_request_id uuid references public.port_in_requests (id) on delete cascade,
  workspace_id uuid,
  user_id uuid,
  status text not null,
  twilio_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid,
  provider text not null,
  conversation_id uuid,
  lead_id uuid,
  external_client_id text,
  external_record_id text,
  matched_existing boolean not null default false,
  summary text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.integration_connections to authenticated;
grant all on public.integration_connections to service_role;
alter table public.integration_connections enable row level security;
drop policy if exists "users read their integration connections" on public.integration_connections;
create policy "users read their integration connections" on public.integration_connections
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
drop policy if exists "users write their integration connections" on public.integration_connections;
create policy "users write their integration connections" on public.integration_connections
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update their integration connections" on public.integration_connections;
create policy "users update their integration connections" on public.integration_connections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete their integration connections" on public.integration_connections;
create policy "users delete their integration connections" on public.integration_connections
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.review_settings to authenticated;
grant all on public.review_settings to service_role;
alter table public.review_settings enable row level security;
drop policy if exists "users manage their review settings" on public.review_settings;
create policy "users manage their review settings" on public.review_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.review_requests to authenticated;
grant all on public.review_requests to service_role;
alter table public.review_requests enable row level security;
drop policy if exists "users read their review requests" on public.review_requests;
create policy "users read their review requests" on public.review_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.consent_log to authenticated;
grant all on public.consent_log to service_role;
alter table public.consent_log enable row level security;
drop policy if exists "users read their consent log" on public.consent_log;
create policy "users read their consent log" on public.consent_log
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.payment_links to authenticated;
grant all on public.payment_links to service_role;
alter table public.payment_links enable row level security;
drop policy if exists "users read their payment links" on public.payment_links;
create policy "users read their payment links" on public.payment_links
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.port_in_requests to authenticated;
grant all on public.port_in_requests to service_role;
alter table public.port_in_requests enable row level security;
drop policy if exists "users read their port-in requests" on public.port_in_requests;
create policy "users read their port-in requests" on public.port_in_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.port_in_events to authenticated;
grant all on public.port_in_events to service_role;
alter table public.port_in_events enable row level security;
drop policy if exists "users read their port-in events" on public.port_in_events;
create policy "users read their port-in events" on public.port_in_events
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

grant select on public.trade_syncs to authenticated;
grant all on public.trade_syncs to service_role;
alter table public.trade_syncs enable row level security;
drop policy if exists "users read their trade syncs" on public.trade_syncs;
create policy "users read their trade syncs" on public.trade_syncs
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Secrets, OAuth verifiers, and utility bills are server-only.
revoke all on public.integration_secrets from anon, authenticated;
revoke all on public.oauth_transactions from anon, authenticated;
revoke all on public.port_in_private from anon, authenticated;
revoke all on public.stripe_connect_events from anon, authenticated;
grant all on public.integration_secrets to service_role;
grant all on public.oauth_transactions to service_role;
grant all on public.port_in_private to service_role;
grant all on public.stripe_connect_events to service_role;
alter table public.integration_secrets enable row level security;
alter table public.oauth_transactions enable row level security;
alter table public.port_in_private enable row level security;
alter table public.stripe_connect_events enable row level security;
