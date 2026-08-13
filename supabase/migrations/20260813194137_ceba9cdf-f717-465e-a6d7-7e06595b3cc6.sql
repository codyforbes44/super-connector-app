CREATE TABLE public.digest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.digest_queue TO authenticated;
GRANT ALL ON public.digest_queue TO service_role;

ALTER TABLE public.digest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own digest queue"
  ON public.digest_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX digest_queue_pending_idx ON public.digest_queue (user_id, sent, created_at);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS digest_hour integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'sixvox-daily-digest',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://sixvox.3bi.io/api/public/digest/run',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_LQJZpEwwab8Dri8yCtPFyA_weSTvhBi"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  ) as request_id;
  $$
);