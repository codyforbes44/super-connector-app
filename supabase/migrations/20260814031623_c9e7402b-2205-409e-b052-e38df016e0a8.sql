CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text UNIQUE,
  session_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'text',
  page text,
  referrer text,
  status text NOT NULL DEFAULT 'open',
  outcome text,
  summary text,
  intent text,
  urgency text,
  lead_quality text,
  answered boolean,
  unanswered_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  topics text[] NOT NULL DEFAULT '{}',
  duration_seconds integer,
  turn_count integer NOT NULL DEFAULT 0,
  handoff_requested boolean NOT NULL DEFAULT false,
  dynamic_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  tool_name text,
  tool_payload jsonb,
  at_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  company text,
  need text,
  urgency text,
  plan_interest text,
  quality text,
  source text NOT NULL DEFAULT 'concierge',
  page text,
  handled boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.chat_leads(id) ON DELETE SET NULL,
  name text,
  phone text NOT NULL,
  email text,
  window_label text NOT NULL,
  timezone text,
  topic text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_conversation_idx ON public.chat_messages (conversation_id, created_at);
CREATE INDEX chat_conversations_created_idx ON public.chat_conversations (created_at DESC);
CREATE INDEX chat_leads_created_idx ON public.chat_leads (created_at DESC);

GRANT SELECT ON public.chat_conversations TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT SELECT, UPDATE ON public.chat_leads TO authenticated;
GRANT SELECT, UPDATE ON public.chat_callbacks TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.chat_leads TO service_role;
GRANT ALL ON public.chat_callbacks TO service_role;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read concierge conversations" ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins read concierge messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins read concierge leads" ON public.chat_leads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update concierge leads" ON public.chat_leads
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins read concierge callbacks" ON public.chat_callbacks
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update concierge callbacks" ON public.chat_callbacks
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER chat_conversations_updated_at BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chat_leads_updated_at BEFORE UPDATE ON public.chat_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chat_callbacks_updated_at BEFORE UPDATE ON public.chat_callbacks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();