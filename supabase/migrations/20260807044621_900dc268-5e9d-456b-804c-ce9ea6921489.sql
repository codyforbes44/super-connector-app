ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workspace_name text,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent') ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan_code, status, billing_interval, seats, trial_ends_at, current_period_end)
  VALUES (NEW.id, 'team', 'trialing', 'month', 1, now() + interval '14 days', now() + interval '14 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.subscriptions (user_id, plan_code, status, billing_interval, seats, trial_ends_at, current_period_end)
SELECT p.id, 'team', 'trialing', 'month', 1, now() + interval '14 days', now() + interval '14 days'
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.id IS NULL;