-- Contacts enrichment
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS place_id text;

-- Number booking settings
ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS calendar_id text,
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_slot_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_buffer_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS booking_hours jsonb NOT NULL DEFAULT '{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}'::jsonb;

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text,
  email_missed_call boolean NOT NULL DEFAULT true,
  email_voicemail boolean NOT NULL DEFAULT true,
  email_inbound_message boolean NOT NULL DEFAULT true,
  email_ai_summary boolean NOT NULL DEFAULT true,
  email_account boolean NOT NULL DEFAULT true,
  email_daily_digest boolean NOT NULL DEFAULT false,
  digest_mode text NOT NULL DEFAULT 'instant',
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_start text NOT NULL DEFAULT '22:00',
  quiet_end text NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification prefs" ON public.notification_prefs
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Email log
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  to_address text NOT NULL,
  subject text NOT NULL,
  provider_id text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read email log" ON public.email_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Calendar bookings
CREATE TABLE IF NOT EXISTS public.calendar_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  calendar_id text NOT NULL,
  app_number text NOT NULL,
  contact_number text,
  contact_email text,
  summary text,
  html_link text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  call_sid text,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.calendar_bookings TO authenticated;
GRANT ALL ON public.calendar_bookings TO service_role;
ALTER TABLE public.calendar_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings visible to owner of number" ON public.calendar_bookings
  FOR SELECT TO authenticated USING (public.can_see_number(auth.uid(), app_number));
CREATE TRIGGER update_calendar_bookings_updated_at BEFORE UPDATE ON public.calendar_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS calendar_bookings_number_idx ON public.calendar_bookings(app_number, starts_at DESC);
CREATE INDEX IF NOT EXISTS email_log_created_idx ON public.email_log(created_at DESC);