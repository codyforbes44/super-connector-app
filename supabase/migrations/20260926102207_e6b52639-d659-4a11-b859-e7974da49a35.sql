-- Backfill workspace_id on tables added by the release-train feature PRs.
--
-- Those migrations (missed-call text-back, Phase 2 compliance, trade
-- integrations, and any AI receptionist tables that land before this file)
-- add a nullable workspace_id with no foreign key. They sort after
-- 20260926120000_phase1_workspaces.sql, so that migration's table list never
-- sees them. This file runs after the 2026-09-26 feature migrations.
--
-- Tables with no workspace_id stay as they are: integration_secrets,
-- oauth_transactions, stripe_connect_events, port_in_private, and
-- mobile_call_acks. Marketing leads get a founding-workspace backfill and a
-- foreign key, and stay nullable so public lead capture can omit the column.
--
-- If voice_presence.device_key exists (native calling), the per-user unique
-- index from Phase 1 is dropped so a browser and a phone can both be present.

DO $$
DECLARE
  founding uuid := '11111111-1111-4111-8111-111111111111';
  phase1 text[] := ARRAY[
    'phone_numbers', 'calls', 'messages', 'conversations', 'contacts',
    'call_transcripts', 'call_intelligence', 'contact_memory', 'caller_rules',
    'caller_id_verifications', 'caller_id_routes', 'voice_presence',
    'push_subscriptions', 'a2p_registrations', 'byo_numbers', 'subscriptions',
    'audit_log', 'templates', 'lookups', 'ai_conversations', 'twiml_apps',
    'saved_places', 'place_searches', 'calendar_settings', 'calendar_bookings',
    'app_user_connections', 'notification_prefs', 'email_log',
    'email_template_overrides', 'digest_queue', 'webhook_errors', 'esim_orders'
  ];
  known text[] := ARRAY[
    'missed_call_textbacks', 'outbound_webhook_endpoints', 'outbound_webhook_deliveries',
    'emergency_addresses', 'e911_acknowledgments', 'sms_opt_outs', 'sms_consent_log',
    'sms_quiet_hours', 'ai_voice_consents', 'trust_hub_registrations',
    'messaging_opt_out_prefs', 'integration_connections', 'review_settings',
    'review_requests', 'consent_log', 'payment_links', 'port_in_requests',
    'port_in_events', 'trade_syncs',
    'booking_proposals', 'caller_lists', 'caller_line_cache'
  ];
  -- Shared carrier lookup. Rows are written by the service role with no member
  -- session, so workspace_id stays nullable after the founding backfill.
  stay_nullable text[] := ARRAY['caller_line_cache'];
  skip text[] := ARRAY[
    'workspaces', 'workspace_members', 'workspace_twilio', 'workspace_entitlements',
    'number_assignees', 'activation_events', 'plan_limits', 'phone_verifications',
    'leads'
  ];
  t text;
  targets text[] := ARRAY[]::text[];
  leftover bigint;
  has_founding boolean;
  has_user_id boolean;
  r record;
BEGIN
  IF to_regclass('public.workspaces') IS NULL THEN
    RAISE EXCEPTION 'phase1 workspaces migration must run before the sibling backfill';
  END IF;

  IF to_regclass('public.caller_line_cache') IS NOT NULL THEN
    ALTER TABLE public.caller_line_cache
      ADD COLUMN IF NOT EXISTS workspace_id uuid;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = founding) INTO has_founding;

  FOR t IN
    SELECT table_name
    FROM (
      SELECT unnest(known) AS table_name
      UNION
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables bt
        ON bt.table_schema = c.table_schema
       AND bt.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'workspace_id'
        AND bt.table_type = 'BASE TABLE'
        AND c.table_name <> ALL (phase1 || skip)
    ) found
    ORDER BY table_name
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'workspace_id'
    ) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'user_id'
    ) INTO has_user_id;

    IF has_founding AND has_user_id THEN
      EXECUTE format(
        'UPDATE public.%I AS target
         SET workspace_id = picked.workspace_id
         FROM (
           SELECT DISTINCT ON (user_id) user_id, workspace_id
           FROM public.workspace_members
           ORDER BY user_id,
             CASE role WHEN ''owner'' THEN 0 WHEN ''admin'' THEN 1 ELSE 2 END,
             created_at
         ) AS picked
         WHERE target.workspace_id IS NULL
           AND target.user_id = picked.user_id',
        t
      );
    END IF;

    IF has_founding THEN
      EXECUTE format(
        'UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL',
        t, founding
      );
    END IF;

    targets := array_append(targets, t);
  END LOOP;

  -- Parents are filled above. Children follow them after every table has a workspace.
  IF has_founding AND to_regclass('public.missed_call_textbacks') IS NOT NULL
     AND to_regclass('public.phone_numbers') IS NOT NULL THEN
    UPDATE public.missed_call_textbacks m
    SET workspace_id = p.workspace_id
    FROM public.phone_numbers p
    WHERE m.app_number = p.phone_number
      AND p.workspace_id IS NOT NULL
      AND m.workspace_id IS DISTINCT FROM p.workspace_id;
  END IF;

  IF has_founding AND to_regclass('public.emergency_addresses') IS NOT NULL
     AND to_regclass('public.phone_numbers') IS NOT NULL THEN
    UPDATE public.emergency_addresses e
    SET workspace_id = p.workspace_id
    FROM public.phone_numbers p
    WHERE (e.phone_number = p.phone_number OR e.phone_number_sid = p.sid)
      AND p.workspace_id IS NOT NULL
      AND e.workspace_id IS DISTINCT FROM p.workspace_id;
  END IF;

  IF has_founding AND to_regclass('public.outbound_webhook_deliveries') IS NOT NULL
     AND to_regclass('public.outbound_webhook_endpoints') IS NOT NULL THEN
    UPDATE public.outbound_webhook_deliveries d
    SET workspace_id = e.workspace_id
    FROM public.outbound_webhook_endpoints e
    WHERE d.endpoint_id = e.id
      AND e.workspace_id IS NOT NULL
      AND d.workspace_id IS DISTINCT FROM e.workspace_id;
  END IF;

  IF has_founding AND to_regclass('public.port_in_events') IS NOT NULL
     AND to_regclass('public.port_in_requests') IS NOT NULL THEN
    UPDATE public.port_in_events ev
    SET workspace_id = req.workspace_id
    FROM public.port_in_requests req
    WHERE ev.port_in_request_id = req.id
      AND req.workspace_id IS NOT NULL
      AND ev.workspace_id IS DISTINCT FROM req.workspace_id;
  END IF;

  FOREACH t IN ARRAY targets LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)',
      t || '_workspace_idx', t
    );
    BEGIN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)',
        t, t || '_workspace_id_fkey'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id IS NULL', t) INTO leftover;
    IF leftover = 0 AND t <> ALL (stay_nullable) THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
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
    EXECUTE format('DROP TRIGGER IF EXISTS assign_workspace_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER assign_workspace_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assign_workspace_id()',
      t
    );
  END LOOP;

  IF to_regclass('public.leads') IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'workspace_id'
  ) THEN
    IF has_founding THEN
      UPDATE public.leads SET workspace_id = founding WHERE workspace_id IS NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS leads_workspace_idx ON public.leads (workspace_id);
    BEGIN
      ALTER TABLE public.leads
        ADD CONSTRAINT leads_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'voice_presence'
      AND column_name = 'device_key'
  ) THEN
    DROP INDEX IF EXISTS public.voice_presence_user_id_uidx;
  END IF;
END $$;