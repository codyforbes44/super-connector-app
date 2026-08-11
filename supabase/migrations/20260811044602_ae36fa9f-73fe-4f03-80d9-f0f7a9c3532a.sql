ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS push_esim_ready boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_esim_failed boolean NOT NULL DEFAULT true;