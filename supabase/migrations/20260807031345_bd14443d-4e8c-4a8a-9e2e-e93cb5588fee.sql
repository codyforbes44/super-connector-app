CREATE TABLE public.twiml_apps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sid text NOT NULL UNIQUE,
  friendly_name text NOT NULL,
  voice_url text,
  sms_url text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.twiml_apps TO authenticated;
GRANT ALL ON public.twiml_apps TO service_role;

ALTER TABLE public.twiml_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "twiml apps readable" ON public.twiml_apps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage twiml apps" ON public.twiml_apps
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_twiml_apps_updated_at
  BEFORE UPDATE ON public.twiml_apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX twiml_apps_single_default ON public.twiml_apps (is_default) WHERE is_default;

ALTER TABLE public.calls ADD COLUMN client_identity text;
ALTER TABLE public.calls ADD COLUMN answered_in_app boolean NOT NULL DEFAULT false;