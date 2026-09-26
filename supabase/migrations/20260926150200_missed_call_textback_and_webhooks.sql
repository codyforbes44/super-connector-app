-- Rollback:
--   drop table if exists public.outbound_webhook_deliveries;
--   drop table if exists public.outbound_webhook_endpoints;
--   drop table if exists public.missed_call_textbacks;
--   alter table public.phone_numbers
--     drop constraint if exists phone_numbers_after_hours_route_check,
--     drop constraint if exists phone_numbers_text_back_dedupe_check,
--     drop column if exists text_back_enabled,
--     drop column if exists text_back_template,
--     drop column if exists text_back_on_ai,
--     drop column if exists text_back_on_voicemail,
--     drop column if exists text_back_dedupe_minutes,
--     drop column if exists business_hours_enabled,
--     drop column if exists business_timezone,
--     drop column if exists business_hours,
--     drop column if exists business_holidays,
--     drop column if exists after_hours_route,
--     drop column if exists emergency_keywords,
--     drop column if exists emergency_transfer_number;
--   -- workspace_id on phone_numbers and calls is also added by the receptionist
--   -- migration. Drop it only when both features are rolled back:
--   --   alter table public.phone_numbers drop column if exists workspace_id;
--   --   alter table public.calls drop column if exists workspace_id;
--   alter table public.calls drop column if exists dial_status;

-- Missed-call text-back, business hours, emergency keywords, and signed outbound webhooks.
-- workspace_id is nullable on purpose. Phase 1's workspace migration should use
-- ADD COLUMN IF NOT EXISTS so the two branches compose.

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS text_back_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_back_template text NOT NULL DEFAULT 'Sorry we missed your call. Text us back on this number and we''ll help as soon as we can.',
  ADD COLUMN IF NOT EXISTS text_back_on_ai boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_back_on_voicemail boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS text_back_dedupe_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS business_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{"sun":[],"mon":[{"open":"08:00","close":"17:00"}],"tue":[{"open":"08:00","close":"17:00"}],"wed":[{"open":"08:00","close":"17:00"}],"thu":[{"open":"08:00","close":"17:00"}],"fri":[{"open":"08:00","close":"17:00"}],"sat":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS after_hours_route text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS emergency_keywords jsonb NOT NULL DEFAULT '["burst pipe","flooding","gas leak","no heat"]'::jsonb,
  ADD COLUMN IF NOT EXISTS emergency_transfer_number text;

ALTER TABLE public.phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_after_hours_route_check;
ALTER TABLE public.phone_numbers
  ADD CONSTRAINT phone_numbers_after_hours_route_check
  CHECK (after_hours_route IN ('ai', 'voicemail'));

ALTER TABLE public.phone_numbers DROP CONSTRAINT IF EXISTS phone_numbers_text_back_dedupe_check;
ALTER TABLE public.phone_numbers
  ADD CONSTRAINT phone_numbers_text_back_dedupe_check
  CHECK (text_back_dedupe_minutes BETWEEN 5 AND 1440);

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS dial_status text;

CREATE TABLE IF NOT EXISTS public.missed_call_textbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  call_sid text NOT NULL UNIQUE,
  app_number text NOT NULL,
  contact_number text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'pending',
  skip_reason text,
  message_sid text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS missed_call_textbacks_pair_idx
  ON public.missed_call_textbacks (app_number, contact_number, created_at DESC);

GRANT SELECT ON public.missed_call_textbacks TO authenticated;
GRANT ALL ON public.missed_call_textbacks TO service_role;
ALTER TABLE public.missed_call_textbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read missed call texts" ON public.missed_call_textbacks;
CREATE POLICY "admins read missed call texts" ON public.missed_call_textbacks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.outbound_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  url text NOT NULL,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT ARRAY['call.missed', 'call.completed', 'message.received']::text[],
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_webhook_endpoints TO authenticated;
GRANT ALL ON public.outbound_webhook_endpoints TO service_role;
ALTER TABLE public.outbound_webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage webhook endpoints" ON public.outbound_webhook_endpoints;
CREATE POLICY "admins manage webhook endpoints" ON public.outbound_webhook_endpoints
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.outbound_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.outbound_webhook_endpoints(id) ON DELETE CASCADE,
  workspace_id uuid,
  event_type text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_status_code integer,
  last_error text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint_id, event_id)
);

CREATE INDEX IF NOT EXISTS outbound_webhook_deliveries_due_idx
  ON public.outbound_webhook_deliveries (next_attempt_at)
  WHERE status = 'pending';

GRANT SELECT ON public.outbound_webhook_deliveries TO authenticated;
GRANT ALL ON public.outbound_webhook_deliveries TO service_role;
ALTER TABLE public.outbound_webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read webhook deliveries" ON public.outbound_webhook_deliveries;
CREATE POLICY "admins read webhook deliveries" ON public.outbound_webhook_deliveries
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
