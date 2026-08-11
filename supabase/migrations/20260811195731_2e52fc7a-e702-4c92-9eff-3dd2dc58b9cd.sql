-- Transcripts of conversations
CREATE TABLE public.call_transcripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_sid text NOT NULL,
  app_number text,
  contact_number text,
  source text NOT NULL DEFAULT 'stt',
  turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  full_text text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (call_sid, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_transcripts TO authenticated;
GRANT ALL ON public.call_transcripts TO service_role;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their transcripts" ON public.call_transcripts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Owners write their transcripts" ON public.call_transcripts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update their transcripts" ON public.call_transcripts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete their transcripts" ON public.call_transcripts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_call_transcripts_updated_at BEFORE UPDATE ON public.call_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX call_transcripts_user_idx ON public.call_transcripts (user_id, created_at DESC);
CREATE INDEX call_transcripts_fts_idx ON public.call_transcripts
  USING gin (to_tsvector('english', full_text));

-- AI analysis per call
CREATE TABLE public.call_intelligence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_sid text NOT NULL UNIQUE,
  app_number text,
  contact_number text,
  summary text,
  intent text,
  sentiment text,
  urgency text,
  topics text[] NOT NULL DEFAULT '{}',
  entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_intelligence TO authenticated;
GRANT ALL ON public.call_intelligence TO service_role;
ALTER TABLE public.call_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their call intelligence" ON public.call_intelligence
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Owners write their call intelligence" ON public.call_intelligence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update their call intelligence" ON public.call_intelligence
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete their call intelligence" ON public.call_intelligence
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_call_intelligence_updated_at BEFORE UPDATE ON public.call_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX call_intelligence_user_idx ON public.call_intelligence (user_id, created_at DESC);
CREATE INDEX call_intelligence_contact_idx ON public.call_intelligence (user_id, contact_number);
CREATE INDEX call_intelligence_fts_idx ON public.call_intelligence
  USING gin (to_tsvector('english', coalesce(summary,'') || ' ' || coalesce(intent,'')));

-- Rolling memory per contact number
CREATE TABLE public.contact_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_number text NOT NULL,
  rolling_summary text NOT NULL DEFAULT '',
  last_call_at timestamp with time zone,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_memory TO authenticated;
GRANT ALL ON public.contact_memory TO service_role;
ALTER TABLE public.contact_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their contact memory" ON public.contact_memory
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_contact_memory_updated_at BEFORE UPDATE ON public.contact_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-caller behaviour rules
CREATE TABLE public.caller_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_number text NOT NULL,
  label text,
  behavior text NOT NULL DEFAULT 'screen',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caller_rules TO authenticated;
GRANT ALL ON public.caller_rules TO service_role;
ALTER TABLE public.caller_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their caller rules" ON public.caller_rules
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_caller_rules_updated_at BEFORE UPDATE ON public.caller_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Account level assistant settings
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS transcribe_calls boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assistant_instructions text,
  ADD COLUMN IF NOT EXISTS digest_enabled boolean NOT NULL DEFAULT false;