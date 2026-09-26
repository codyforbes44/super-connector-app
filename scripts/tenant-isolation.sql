-- Proves a member of workspace A cannot read workspace B rows.
-- Self-contained: stubs auth.uid() and applies the same membership policies
-- as supabase/migrations/20260926120000_phase1_workspaces.sql.
-- Run as a superuser against an empty database (CI postgres service).

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL
);

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.%I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL)',
      t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _workspace_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.user_id = _user_id AND m.workspace_id = _workspace_id
  );
$$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

DO $$
DECLARE
  t text;
  r record;
  tables text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR r IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id))',
      t || '_workspace_select', t
    );
  END LOOP;
END $$;

TRUNCATE public.phone_numbers, public.calls, public.messages, public.conversations, public.contacts,
  public.call_transcripts, public.call_intelligence, public.contact_memory, public.caller_rules,
  public.caller_id_verifications, public.caller_id_routes, public.voice_presence,
  public.push_subscriptions, public.a2p_registrations, public.byo_numbers, public.subscriptions,
  public.audit_log, public.templates, public.lookups, public.ai_conversations, public.twiml_apps,
  public.saved_places, public.place_searches, public.calendar_settings, public.calendar_bookings,
  public.app_user_connections, public.notification_prefs, public.email_log,
  public.email_template_overrides, public.digest_queue, public.webhook_errors, public.esim_orders,
  public.workspace_members, public.user_roles, public.workspaces;

INSERT INTO public.workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'owner');

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'INSERT INTO public.%I (workspace_id) VALUES (%L), (%L)',
      t,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    );
  END LOOP;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);

DO $$
DECLARE
  t text;
  own_count bigint;
  other_count bigint;
  tables text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE workspace_id = %L',
      t, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    ) INTO own_count;
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE workspace_id = %L',
      t, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    ) INTO other_count;
    IF own_count <> 1 THEN
      RAISE EXCEPTION 'tenant isolation: % expected 1 own row, saw %', t, own_count;
    END IF;
    IF other_count <> 0 THEN
      RAISE EXCEPTION 'tenant isolation: % leaked % rows from the other workspace', t, other_count;
    END IF;
  END LOOP;
END $$;

RESET ROLE;
