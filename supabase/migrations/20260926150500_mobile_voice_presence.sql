-- Native calling: one voice_presence row per device, plus a call-ack
-- used by the PSTN fallback (MOBILE_PSTN_FALLBACK, default off).
--
-- identity stays the primary key. user_id is not unique so a browser and a
-- phone can both be present. If a live database added a unique constraint on
-- user_id outside these migrations, drop it before shipping the native app:
--   ALTER TABLE public.voice_presence DROP CONSTRAINT IF EXISTS voice_presence_user_id_key;
--
-- workspace_id is intentionally absent. The multi-tenant work adds it to
-- tenant tables; this migration only adds columns and one new table so it
-- rebases as an append.

ALTER TABLE public.voice_presence
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS device_key text;

CREATE UNIQUE INDEX IF NOT EXISTS voice_presence_user_device_idx
  ON public.voice_presence (user_id, device_key)
  WHERE device_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mobile_call_acks (
  call_sid text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acked_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.mobile_call_acks TO service_role;
ALTER TABLE public.mobile_call_acks ENABLE ROW LEVEL SECURITY;
-- No authenticated policy. The mobile API writes with the service role
-- after it has checked the session, and the voice webhook reads the same way.
