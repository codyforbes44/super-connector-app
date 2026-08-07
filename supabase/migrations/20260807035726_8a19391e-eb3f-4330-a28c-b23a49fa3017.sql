-- ---------- role helpers ----------
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','owner','admin'))
$$;

-- new signups are agents; super admin is granted by verified email only
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_super_admin_for_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'codyforbes@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_super_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin_for_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_super_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_super_admin_for_email();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin' FROM public.profiles WHERE lower(email) = 'codyforbes@gmail.com'
ON CONFLICT DO NOTHING;

-- ---------- plans ----------
CREATE TABLE public.plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_monthly integer NOT NULL DEFAULT 0,
  price_yearly integer NOT NULL DEFAULT 0,
  included_numbers integer NOT NULL DEFAULT 1,
  included_seats integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlighted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans are public" ON public.plans FOR SELECT TO anon, authenticated USING (active);
CREATE POLICY "super admin manages plans" ON public.plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (code, name, tagline, price_monthly, price_yearly, included_numbers, included_seats, features, highlighted, sort_order) VALUES
('solo','Solo','One number, everything that matters.',2900,29000,1,1,
 '["1 Twilio number","1 seat","SMS, MMS and calling","Voicemail with transcription","Call history and recordings","Push and email alerts"]'::jsonb,false,1),
('team','Team','A shared inbox for the whole crew.',7900,79000,3,5,
 '["3 Twilio numbers","5 seats","Everything in Solo","WhatsApp channel","Shared inbox with assignment","AI voicemail assistants","Verify and Lookup","Gmail, Calendar and Maps tools"]'::jsonb,true,2),
('scale','Scale','Unrestricted Twilio, no ceiling.',19900,199000,10,NULL,
 '["10 Twilio numbers","Unlimited seats","Everything in Team","Messaging Services and A2P","Unrestricted API console","Priority alerting","Subaccount and usage insight"]'::jsonb,false,3);

-- ---------- subscriptions ----------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_code text REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'incomplete',
  billing_interval text NOT NULL DEFAULT 'month',
  seats integer NOT NULL DEFAULT 1,
  comped boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_status_idx ON public.subscriptions (status);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own subscription" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND s.suspended = false
      AND (s.comped OR (s.status IN ('active','trialing')
        AND (s.current_period_end IS NULL OR s.current_period_end > now())))
  )
$$;

-- super admin is always entitled
INSERT INTO public.subscriptions (user_id, plan_code, status, comped, seats)
SELECT id, 'scale', 'active', true, 99 FROM public.profiles WHERE lower(email) = 'codyforbes@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ---------- leads ----------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact',
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads leads" ON public.leads FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin updates leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));