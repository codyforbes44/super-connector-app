-- Phase 2: E911, recording consent, Trust Hub drafts, TCPA opt-out.
-- workspace_id is nullable on every new customer-owned table. Phase 1 backfills
-- it and turns on enforcement. There is no workspaces table in this migration.

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS record_calls boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.phone_numbers.record_calls IS
  'Live call recording for this line. Off by default. When on, every recorded leg plays an all-party notice first. Voicemail always records and always plays the notice.';

CREATE TABLE public.emergency_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  phone_number_sid text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  twilio_address_sid text,
  customer_name text NOT NULL,
  street text NOT NULL,
  street_secondary text,
  city text NOT NULL,
  region text NOT NULL,
  postal_code text NOT NULL,
  iso_country text NOT NULL DEFAULT 'US',
  emergency_enabled boolean NOT NULL DEFAULT false,
  emergency_status text,
  emergency_address_status text,
  validated boolean,
  suggested_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  fee_acknowledged_at timestamptz,
  fee_cents integer,
  moved_from_address_sid text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.e911_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disclosure_version text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, disclosure_version)
);

CREATE TABLE public.sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  phone_number text NOT NULL UNIQUE,
  opted_out boolean NOT NULL,
  keyword text,
  source text NOT NULL,
  messaging_service_sid text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sms_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  phone_number text NOT NULL,
  purpose text NOT NULL,
  consented boolean NOT NULL,
  source text NOT NULL,
  recorded_by uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sms_consent_log_phone_idx
  ON public.sms_consent_log (phone_number, purpose, recorded_at DESC);

CREATE TABLE public.sms_quiet_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  quiet_start text NOT NULL DEFAULT '21:00',
  quiet_end text NOT NULL DEFAULT '08:00',
  timezone text NOT NULL DEFAULT 'America/Chicago',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_voice_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  phone_number text NOT NULL,
  consented boolean NOT NULL,
  source text NOT NULL,
  recorded_by uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_voice_consents_phone_idx
  ON public.ai_voice_consents (phone_number, recorded_at DESC);

CREATE TABLE public.trust_hub_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_profile_sid text,
  shaken_stir_sid text,
  cnam_sid text,
  voice_integrity_sid text,
  cnam_display_name text,
  business_id_type text,
  voice_integrity_use_case text,
  employee_count integer,
  daily_call_volume integer,
  owner_confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  last_error text,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messaging_opt_out_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  messaging_service_sid text NOT NULL UNIQUE,
  owner_confirmed_at timestamptz,
  detected_opt_out_type_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.emergency_addresses TO authenticated;
GRANT SELECT ON public.e911_acknowledgments TO authenticated;
GRANT SELECT ON public.sms_opt_outs TO authenticated;
GRANT SELECT ON public.sms_consent_log TO authenticated;
GRANT SELECT ON public.sms_quiet_hours TO authenticated;
GRANT SELECT ON public.ai_voice_consents TO authenticated;
GRANT SELECT ON public.trust_hub_registrations TO authenticated;
GRANT SELECT ON public.messaging_opt_out_prefs TO authenticated;

GRANT ALL ON public.emergency_addresses TO service_role;
GRANT ALL ON public.e911_acknowledgments TO service_role;
GRANT ALL ON public.sms_opt_outs TO service_role;
GRANT ALL ON public.sms_consent_log TO service_role;
GRANT ALL ON public.sms_quiet_hours TO service_role;
GRANT ALL ON public.ai_voice_consents TO service_role;
GRANT ALL ON public.trust_hub_registrations TO service_role;
GRANT ALL ON public.messaging_opt_out_prefs TO service_role;

ALTER TABLE public.emergency_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e911_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_quiet_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_voice_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_hub_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_opt_out_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read emergency addresses" ON public.emergency_addresses
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "users read own e911 acknowledgment" ON public.e911_acknowledgments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "admins read sms opt outs" ON public.sms_opt_outs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "admins read sms consent" ON public.sms_consent_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "users read own quiet hours" ON public.sms_quiet_hours
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "admins read ai voice consent" ON public.ai_voice_consents
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "owners read trust hub" ON public.trust_hub_registrations
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "admins read messaging opt-out prefs" ON public.messaging_opt_out_prefs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_emergency_addresses_updated_at
  BEFORE UPDATE ON public.emergency_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_sms_quiet_hours_updated_at
  BEFORE UPDATE ON public.sms_quiet_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_trust_hub_registrations_updated_at
  BEFORE UPDATE ON public.trust_hub_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_messaging_opt_out_prefs_updated_at
  BEFORE UPDATE ON public.messaging_opt_out_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
