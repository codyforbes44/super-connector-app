ALTER TABLE public.phone_numbers ADD COLUMN IF NOT EXISTS elevenlabs_phone_number_id text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS answer_path text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS error_code text;

CREATE TABLE IF NOT EXISTS public.voice_presence (
  identity text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_presence TO authenticated;
GRANT ALL ON public.voice_presence TO service_role;

ALTER TABLE public.voice_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own voice presence"
ON public.voice_presence FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_voice_presence_updated_at
BEFORE UPDATE ON public.voice_presence
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();