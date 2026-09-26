-- Phase 1: workspaces, membership, entitlements, and per-tenant RLS.
--
-- Existing rows move into one founding workspace owned by every current
-- platform owner (and super admin). The founding workspace keeps using the
-- parent Twilio account until an owner runs the in-app migration action.
-- Its A2P status is grandfathered as approved.
--
-- Rollback is not automatic. See docs/phase1-migration.md. Take a database
-- backup before applying this to production.

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  business_name text,
  website text,
  hours text,
  ai_greeting text,
  verified_phone text,
  a2p_grandfathered boolean NOT NULL DEFAULT false,
  a2p_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx ON public.workspace_members (user_id);

CREATE TABLE IF NOT EXISTS public.workspace_twilio (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subaccount_sid text,
  subaccount_auth_token_encrypted text,
  api_key_sid text,
  api_key_secret_encrypted text,
  twiml_app_sid text,
  messaging_service_sid text,
  uses_parent_account boolean NOT NULL DEFAULT false,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_code text PRIMARY KEY,
  max_numbers integer NOT NULL,
  max_seats integer NOT NULL,
  included_ai_calls integer NOT NULL,
  ai_minute_cap integer,
  allow_international boolean NOT NULL DEFAULT false,
  sms_per_hour integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plan_limits (
  plan_code, max_numbers, max_seats, included_ai_calls, ai_minute_cap, allow_international, sms_per_hour
) VALUES
  ('trial', 1, 1, 20, 60, false, 30),
  ('solo', 1, 1, 50, NULL, false, 120),
  ('team', 3, 5, 200, NULL, true, 400),
  ('scale', 10, 20, 600, NULL, true, 1000)
ON CONFLICT (plan_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.workspace_entitlements (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'trial',
  status text NOT NULL DEFAULT 'trialing',
  max_numbers integer NOT NULL,
  max_seats integer NOT NULL,
  included_ai_calls integer NOT NULL,
  ai_minute_cap integer,
  ai_calls_used integer NOT NULL DEFAULT 0,
  ai_minutes_used integer NOT NULL DEFAULT 0,
  allow_international boolean NOT NULL DEFAULT false,
  sms_per_hour integer NOT NULL,
  stripe_subscription_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.number_assignees (
  phone_number_id uuid NOT NULL REFERENCES public.phone_numbers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone_number_id, user_id)
);

CREATE INDEX IF NOT EXISTS number_assignees_workspace_idx ON public.number_assignees (workspace_id);

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activation_events_workspace_idx
  ON public.activation_events (workspace_id, event, created_at DESC);

-- ---------------------------------------------------------------------------
-- workspace_id on every tenant table
-- TENANT_TABLES: phone_numbers, calls, messages, conversations, contacts, call_transcripts, call_intelligence, contact_memory, caller_rules, caller_id_verifications, caller_id_routes, voice_presence, push_subscriptions, a2p_registrations, byo_numbers, subscriptions, audit_log, templates, lookups, ai_conversations, twiml_apps, saved_places, place_searches, calendar_settings, calendar_bookings, app_user_connections, notification_prefs, email_log, email_template_overrides, digest_queue, webhook_errors, esim_orders
-- ---------------------------------------------------------------------------

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
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', t);
  END LOOP;
END $$;

ALTER TABLE public.a2p_registrations
  ADD COLUMN IF NOT EXISTS registration_path text,
  ADD COLUMN IF NOT EXISTS fee_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS grandfathered boolean NOT NULL DEFAULT false;

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_account_sid text,
  ADD COLUMN IF NOT EXISTS e911_address_sid text;

-- Phase 2 records an emergency address per number (e911_address_sid) and
-- keeps recording consent off until the workspace turns it on. The Secondary
-- Customer Profile SID already stored on a2p_registrations is the TrustHub
-- bundle SHAKEN and CNAM reuse later.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS recording_consent_required boolean NOT NULL DEFAULT false;

-- One presence row per user, matching the app's upsert conflict target.
DELETE FROM public.voice_presence a
USING public.voice_presence b
WHERE a.user_id = b.user_id AND a.identity > b.identity;
CREATE UNIQUE INDEX IF NOT EXISTS voice_presence_user_id_uidx ON public.voice_presence (user_id);

-- ---------------------------------------------------------------------------
-- Founding workspace for data that already exists
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  founding uuid := '11111111-1111-4111-8111-111111111111';
  owner_count integer;
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
  default_app text;
BEGIN
  SELECT count(*) INTO owner_count FROM public.profiles;
  IF owner_count = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.workspaces (
    id, name, slug, business_name, a2p_grandfathered, a2p_status
  ) VALUES (
    founding, 'SixVox', 'sixvox', 'SixVox', true, 'approved'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT founding, ur.user_id,
    CASE
      WHEN bool_or(ur.role::text IN ('owner', 'super_admin')) THEN 'owner'
      WHEN bool_or(ur.role::text = 'admin') THEN 'admin'
      ELSE 'agent'
    END
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  GROUP BY ur.user_id
  ON CONFLICT (workspace_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Profiles with no role row still need a home so their rows are not orphaned.
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT founding, p.id, 'agent'
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = founding AND m.user_id = p.id
  );

  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL',
      t, founding
    );
  END LOOP;

  -- Threads and messages follow the number when that is more specific.
  UPDATE public.conversations c
  SET workspace_id = p.workspace_id
  FROM public.phone_numbers p
  WHERE c.app_number = p.phone_number
    AND p.workspace_id IS NOT NULL
    AND c.workspace_id IS DISTINCT FROM p.workspace_id;

  UPDATE public.messages m
  SET workspace_id = c.workspace_id
  FROM public.conversations c
  WHERE m.conversation_id = c.id
    AND c.workspace_id IS NOT NULL
    AND m.workspace_id IS DISTINCT FROM c.workspace_id;

  UPDATE public.calls c
  SET workspace_id = p.workspace_id
  FROM public.phone_numbers p
  WHERE c.app_number = p.phone_number
    AND p.workspace_id IS NOT NULL;

  SELECT sid INTO default_app
  FROM public.twiml_apps
  WHERE is_default = true
  ORDER BY created_at
  LIMIT 1;

  INSERT INTO public.workspace_twilio (
    workspace_id, twiml_app_sid, uses_parent_account
  ) VALUES (
    founding, default_app, true
  ) ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO public.number_assignees (phone_number_id, user_id, workspace_id)
  SELECT p.id, p.assigned_to, p.workspace_id
  FROM public.phone_numbers p
  WHERE p.assigned_to IS NOT NULL AND p.workspace_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Keep today's ring set: founding owners and admins stay assigned.
  INSERT INTO public.number_assignees (phone_number_id, user_id, workspace_id)
  SELECT p.id, m.user_id, p.workspace_id
  FROM public.phone_numbers p
  JOIN public.workspace_members m
    ON m.workspace_id = p.workspace_id
   AND m.role IN ('owner', 'admin')
  WHERE p.workspace_id = founding
  ON CONFLICT DO NOTHING;

  UPDATE public.phone_numbers
  SET campaign_status = COALESCE(NULLIF(campaign_status, ''), 'APPROVED')
  WHERE workspace_id = founding
    AND (campaign_status IS NULL OR campaign_status = '');

  UPDATE public.a2p_registrations
  SET grandfathered = true,
      campaign_status = COALESCE(campaign_status, 'APPROVED'),
      brand_status = COALESCE(brand_status, 'APPROVED')
  WHERE workspace_id = founding;

  INSERT INTO public.workspace_entitlements (
    workspace_id, plan_code, status, max_numbers, max_seats, included_ai_calls,
    ai_minute_cap, allow_international, sms_per_hour, stripe_subscription_id
  )
  SELECT
    founding,
    COALESCE(sub.plan_code, 'scale'),
    COALESCE(sub.status, 'active'),
    GREATEST(
      COALESCE(lim.max_numbers, 10),
      (SELECT count(*)::integer FROM public.phone_numbers WHERE workspace_id = founding)
    ),
    GREATEST(
      COALESCE(lim.max_seats, 20),
      (SELECT count(*)::integer FROM public.workspace_members WHERE workspace_id = founding)
    ),
    COALESCE(lim.included_ai_calls, 600),
    lim.ai_minute_cap,
    COALESCE(lim.allow_international, true),
    COALESCE(lim.sms_per_hour, 1000),
    sub.stripe_subscription_id
  FROM (SELECT 1) seed
  LEFT JOIN LATERAL (
    SELECT plan_code, status, stripe_subscription_id
    FROM public.subscriptions
    WHERE workspace_id = founding
      AND status IN ('active', 'trialing', 'past_due')
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1
  ) sub ON true
  LEFT JOIN public.plan_limits lim ON lim.plan_code = COALESCE(sub.plan_code, 'scale')
  ON CONFLICT (workspace_id) DO NOTHING;
END $$;

-- Foreign keys and NOT NULL once every existing row has a workspace.
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
  leftover bigint;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)', t || '_workspace_idx', t);
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)',
        t, t || '_workspace_id_fkey'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id IS NULL', t) INTO leftover;
    IF leftover = 0 THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
    END IF;
  END LOOP;
END $$;

-- Contacts and threads are unique inside a workspace, not globally.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_phone_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_workspace_phone_uidx
  ON public.contacts (workspace_id, phone_number);

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_channel_app_number_contact_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_workspace_thread_uidx
  ON public.conversations (workspace_id, channel, app_number, contact_number);

ALTER TABLE public.a2p_registrations DROP CONSTRAINT IF EXISTS a2p_registrations_user_id_key;
-- One registration per workspace. Keep the newest row if a legacy per-user table has more than one.
DELETE FROM public.a2p_registrations a
USING public.a2p_registrations b
WHERE a.workspace_id = b.workspace_id
  AND a.workspace_id IS NOT NULL
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id::text < b.id::text));
CREATE UNIQUE INDEX IF NOT EXISTS a2p_registrations_workspace_uidx
  ON public.a2p_registrations (workspace_id);

-- ---------------------------------------------------------------------------
-- Membership helpers. super_admin stays a platform role and can read across
-- workspaces for support. Ordinary members cannot.
-- ---------------------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.user_id = _user_id
      AND m.workspace_id = _workspace_id
      AND m.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_number(_user_id uuid, _number text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1
    FROM public.phone_numbers p
    JOIN public.workspace_members m
      ON m.workspace_id = p.workspace_id AND m.user_id = _user_id
    WHERE p.phone_number = _number
      AND (
        m.role IN ('owner', 'admin')
        OR p.assigned_to = _user_id
        OR EXISTS (
          SELECT 1 FROM public.number_assignees a
          WHERE a.phone_number_id = p.id AND a.user_id = _user_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_workspace_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Replace tenant policies with membership checks
-- ---------------------------------------------------------------------------

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
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
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
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id))',
      t || '_workspace_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id)) WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id))',
      t || '_workspace_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id))',
      t || '_workspace_delete', t
    );
  END LOOP;
END $$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_twilio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), id));

DROP POLICY IF EXISTS workspace_members_select ON public.workspace_members;
CREATE POLICY workspace_members_select ON public.workspace_members
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS workspace_entitlements_select ON public.workspace_entitlements;
CREATE POLICY workspace_entitlements_select ON public.workspace_entitlements
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS plan_limits_select ON public.plan_limits;
CREATE POLICY plan_limits_select ON public.plan_limits
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS number_assignees_select ON public.number_assignees;
CREATE POLICY number_assignees_select ON public.number_assignees
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id));

DROP POLICY IF EXISTS phone_verifications_self ON public.phone_verifications;
CREATE POLICY phone_verifications_self ON public.phone_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS activation_events_select ON public.activation_events;
CREATE POLICY activation_events_select ON public.activation_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_workspace_member(auth.uid(), workspace_id));

-- No authenticated policy on workspace_twilio: subaccount secrets stay server-side.

DROP POLICY IF EXISTS "profiles readable by self or admin" ON public.profiles;
CREATE POLICY "profiles readable by self or workspace" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members mine
      JOIN public.workspace_members theirs ON theirs.workspace_id = mine.workspace_id
      WHERE mine.user_id = auth.uid() AND theirs.user_id = public.profiles.id
    )
  );

DROP POLICY IF EXISTS "roles readable by self or admin" ON public.user_roles;
CREATE POLICY "roles readable by self or super admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- Client inserts rarely pass workspace_id. Fill it from the caller's membership.
-- Service-role writes (auth.uid() is null) must set the column themselves.
CREATE OR REPLACE FUNCTION public.assign_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid uuid;
BEGIN
  IF NEW.workspace_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT m.workspace_id INTO wid
  FROM public.workspace_members m
  WHERE m.user_id = auth.uid()
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at
  LIMIT 1;
  IF wid IS NOT NULL THEN
    NEW.workspace_id := wid;
  END IF;
  RETURN NEW;
END;
$$;

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
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS assign_workspace_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER assign_workspace_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assign_workspace_id()',
      t
    );
  END LOOP;
END $$;

-- A trial subscription is created at signup, before the workspace exists.
ALTER TABLE public.subscriptions ALTER COLUMN workspace_id DROP NOT NULL;
DROP POLICY IF EXISTS subscriptions_workspace_select ON public.subscriptions;
CREATE POLICY subscriptions_workspace_select ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_workspace_member(auth.uid(), workspace_id)
  );

GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT ON public.workspace_entitlements TO authenticated;
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT SELECT ON public.number_assignees TO authenticated;
GRANT SELECT ON public.phone_verifications TO authenticated;
GRANT SELECT ON public.activation_events TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
GRANT ALL ON public.workspace_members TO service_role;
GRANT ALL ON public.workspace_twilio TO service_role;
GRANT ALL ON public.workspace_entitlements TO service_role;
GRANT ALL ON public.plan_limits TO service_role;
GRANT ALL ON public.number_assignees TO service_role;
GRANT ALL ON public.phone_verifications TO service_role;
GRANT ALL ON public.activation_events TO service_role;