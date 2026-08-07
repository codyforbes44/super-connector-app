-- 1. Saved places (favorites)
CREATE TABLE public.saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  label text NOT NULL DEFAULT 'other',
  name text,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  place_id text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved places" ON public.saved_places FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_saved_places_updated_at BEFORE UPDATE ON public.saved_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX saved_places_user_idx ON public.saved_places(user_id, created_at DESC);

-- 2. Recent place searches
CREATE TABLE public.place_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, query)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.place_searches TO authenticated;
GRANT ALL ON public.place_searches TO service_role;
ALTER TABLE public.place_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own place searches" ON public.place_searches FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Email template overrides
CREATE TABLE public.email_template_overrides (
  template text PRIMARY KEY,
  subject text,
  eyebrow text,
  headline text,
  intro text,
  outro text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_template_overrides TO authenticated;
GRANT ALL ON public.email_template_overrides TO service_role;
ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read templates" ON public.email_template_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write templates" ON public.email_template_overrides FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_email_template_overrides_updated_at BEFORE UPDATE ON public.email_template_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Calendar sync settings
CREATE TABLE public.calendar_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_calendars jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_calendar_id text,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  lookback_days integer NOT NULL DEFAULT 7,
  lookahead_days integer NOT NULL DEFAULT 30,
  event_title_template text NOT NULL DEFAULT 'Call with {{contact}}',
  default_duration_minutes integer NOT NULL DEFAULT 30,
  buffer_minutes integer NOT NULL DEFAULT 10,
  invite_contact boolean NOT NULL DEFAULT true,
  add_meet_link boolean NOT NULL DEFAULT false,
  ai_event_status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_settings TO authenticated;
GRANT ALL ON public.calendar_settings TO service_role;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar settings" ON public.calendar_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_calendar_settings_updated_at BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Per-user connector connections (Gmail etc.)
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id text NOT NULL,
  account_email text,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_app_user_connections_updated_at BEFORE UPDATE ON public.app_user_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Email log delivery analytics
ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_click_url text,
  ADD COLUMN IF NOT EXISTS from_address text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS retry_of uuid REFERENCES public.email_log(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS email_log_provider_idx ON public.email_log(provider_id);
CREATE INDEX IF NOT EXISTS email_log_created_idx ON public.email_log(created_at DESC);