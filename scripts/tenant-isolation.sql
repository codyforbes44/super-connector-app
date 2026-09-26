-- Proves a member of workspace A cannot read workspace B rows.
-- Self-contained: stubs auth.uid() and applies the same membership policies
-- as supabase/migrations/20260926120000_phase1_workspaces.sql and
-- 20260927040000_phase1_backfill_sibling_workspace_id.sql.
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
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders',
    'missed_call_textbacks', 'outbound_webhook_endpoints', 'outbound_webhook_deliveries',
    'emergency_addresses', 'e911_acknowledgments', 'sms_opt_outs', 'sms_consent_log',
    'sms_quiet_hours', 'ai_voice_consents', 'trust_hub_registrations',
    'messaging_opt_out_prefs', 'integration_connections', 'review_settings',
    'review_requests', 'consent_log', 'payment_links', 'port_in_requests',
    'port_in_events', 'trade_syncs',
    'booking_proposals', 'caller_lists', 'caller_line_cache'
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
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders',
    'missed_call_textbacks', 'outbound_webhook_endpoints', 'outbound_webhook_deliveries',
    'emergency_addresses', 'e911_acknowledgments', 'sms_opt_outs', 'sms_consent_log',
    'sms_quiet_hours', 'ai_voice_consents', 'trust_hub_registrations',
    'messaging_opt_out_prefs', 'integration_connections', 'review_settings',
    'review_requests', 'consent_log', 'payment_links', 'port_in_requests',
    'port_in_events', 'trade_syncs',
    'booking_proposals', 'caller_lists', 'caller_line_cache'
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
  public.missed_call_textbacks, public.outbound_webhook_endpoints, public.outbound_webhook_deliveries,
  public.emergency_addresses, public.e911_acknowledgments, public.sms_opt_outs, public.sms_consent_log,
  public.sms_quiet_hours, public.ai_voice_consents, public.trust_hub_registrations,
  public.messaging_opt_out_prefs, public.integration_connections, public.review_settings,
  public.review_requests, public.consent_log, public.payment_links, public.port_in_requests,
  public.port_in_events, public.trade_syncs,
  public.booking_proposals, public.caller_lists, public.caller_line_cache,
  public.workspace_members, public.user_roles, public.workspaces
CASCADE;

INSERT INTO public.workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');

-- CI runs this file on an empty database, where these tables do not exist.
-- After the real migrations, workspace_members.user_id references profiles,
-- so the member rows need a profile (and the auth user that creates it).
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    INSERT INTO auth.users (id, email) VALUES
      ('11111111-1111-4111-8111-111111111111', 'a@sixvox.test'),
      ('22222222-2222-4222-8222-222222222222', 'b@sixvox.test')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, display_name) VALUES
      ('11111111-1111-4111-8111-111111111111', 'a@sixvox.test', 'A'),
      ('22222222-2222-4222-8222-222222222222', 'b@sixvox.test', 'B')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'owner');

DO $$
DECLARE
  t text;
  col record;
  cols text;
  vals_a text;
  vals_b text;
  lit text;
  tables text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders',
    'missed_call_textbacks', 'outbound_webhook_endpoints', 'outbound_webhook_deliveries',
    'emergency_addresses', 'e911_acknowledgments', 'sms_opt_outs', 'sms_consent_log',
    'sms_quiet_hours', 'ai_voice_consents', 'trust_hub_registrations',
    'messaging_opt_out_prefs', 'integration_connections', 'review_settings',
    'review_requests', 'consent_log', 'payment_links', 'port_in_requests',
    'port_in_events', 'trade_syncs',
    'booking_proposals', 'caller_lists', 'caller_line_cache'
  ];
BEGIN
  -- Replica role skips foreign-key triggers so the probe can insert one row
  -- per workspace without fabricating every parent. CHECK constraints still apply.
  PERFORM set_config('session_replication_role', 'replica', true);
  FOREACH t IN ARRAY tables LOOP
    cols := '';
    vals_a := '';
    vals_b := '';
    FOR col IN
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND (is_generated IS NULL OR is_generated = 'NEVER')
        AND (
          column_name = 'workspace_id'
          OR (is_nullable = 'NO' AND column_default IS NULL)
        )
      ORDER BY ordinal_position
    LOOP
      IF cols <> '' THEN
        cols := cols || ', ';
        vals_a := vals_a || ', ';
        vals_b := vals_b || ', ';
      END IF;
      cols := cols || quote_ident(col.column_name);
      IF col.column_name = 'workspace_id' THEN
        vals_a := vals_a || quote_literal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
        vals_b := vals_b || quote_literal('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      ELSIF col.column_name = 'user_id' THEN
        vals_a := vals_a || quote_literal('11111111-1111-4111-8111-111111111111');
        vals_b := vals_b || quote_literal('22222222-2222-4222-8222-222222222222');
      ELSIF col.data_type = 'boolean' THEN
        vals_a := vals_a || 'false';
        vals_b := vals_b || 'false';
      ELSIF col.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision') THEN
        vals_a := vals_a || '60';
        vals_b := vals_b || '60';
      ELSIF col.data_type = 'jsonb' THEN
        vals_a := vals_a || quote_literal('{}') || '::jsonb';
        vals_b := vals_b || quote_literal('{}') || '::jsonb';
      ELSIF col.data_type = 'ARRAY' THEN
        vals_a := vals_a || quote_literal('{}') || '::' || col.udt_name;
        vals_b := vals_b || quote_literal('{}') || '::' || col.udt_name;
      ELSIF col.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date') THEN
        vals_a := vals_a || 'now()';
        vals_b := vals_b || 'now()';
      ELSIF col.udt_name = 'uuid' THEN
        vals_a := vals_a || 'gen_random_uuid()';
        vals_b := vals_b || 'gen_random_uuid()';
      ELSE
        -- Unique text columns need distinct values. Known CHECK lists get a legal token.
        IF col.column_name IN ('provider') THEN
          lit := 'jobber';
        ELSIF col.column_name IN ('list') THEN
          lit := 'allow';
        ELSIF col.column_name IN ('after_hours_route', 'answer_mode') THEN
          lit := 'ai';
        ELSIF col.column_name IN ('role') THEN
          lit := 'owner';
        ELSIF col.column_name IN ('status') THEN
          lit := 'active';
        ELSE
          lit := 'probe-' || substr(gen_random_uuid()::text, 1, 8);
        END IF;
        vals_a := vals_a || quote_literal(lit);
        -- Known CHECK tokens must stay legal on both rows. Free text can differ.
        IF col.column_name IN ('provider', 'list', 'after_hours_route', 'answer_mode', 'role', 'status') THEN
          vals_b := vals_b || quote_literal(lit);
        ELSE
          vals_b := vals_b || quote_literal(lit || '-b');
        END IF;
      END IF;
    END LOOP;
    IF cols = '' THEN
      EXECUTE format(
        'INSERT INTO public.%I (workspace_id) VALUES (%L), (%L)',
        t,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      );
    ELSE
      EXECUTE format(
        'INSERT INTO public.%I (%s) VALUES (%s), (%s)',
        t, cols, vals_a, vals_b
      );
    END IF;
  END LOOP;
  PERFORM set_config('session_replication_role', 'origin', true);
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
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders',
    'missed_call_textbacks', 'outbound_webhook_endpoints', 'outbound_webhook_deliveries',
    'emergency_addresses', 'e911_acknowledgments', 'sms_opt_outs', 'sms_consent_log',
    'sms_quiet_hours', 'ai_voice_consents', 'trust_hub_registrations',
    'messaging_opt_out_prefs', 'integration_connections', 'review_settings',
    'review_requests', 'consent_log', 'payment_links', 'port_in_requests',
    'port_in_events', 'trade_syncs',
    'booking_proposals', 'caller_lists', 'caller_line_cache'
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
