ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS answer_mode text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text,
  ADD COLUMN IF NOT EXISTS greeting_audio_path text;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text NOT NULL,
  app_number text NOT NULL,
  agent_id text,
  conversation_id text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_call_sid_key ON public.ai_conversations (call_sid);

GRANT SELECT ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai conversations visible to owner of number"
  ON public.ai_conversations FOR SELECT TO authenticated
  USING (public.can_see_number(auth.uid(), app_number));

CREATE TRIGGER update_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();