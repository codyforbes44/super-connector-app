CREATE TABLE public.phase0_integrity_backups (table_name text NOT NULL, row_id uuid NOT NULL, snapshot jsonb NOT NULL, backed_up_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (table_name,row_id));
GRANT ALL ON public.phase0_integrity_backups TO service_role;
ALTER TABLE public.phase0_integrity_backups ENABLE ROW LEVEL SECURITY;
INSERT INTO public.phase0_integrity_backups(table_name,row_id,snapshot)
SELECT 'calls',id,to_jsonb(t) FROM public.calls t UNION ALL SELECT 'messages',id,to_jsonb(t) FROM public.messages t UNION ALL SELECT 'conversations',id,to_jsonb(t) FROM public.conversations t UNION ALL SELECT 'calendar_bookings',id,to_jsonb(t) FROM public.calendar_bookings t UNION ALL SELECT 'ai_conversations',id,to_jsonb(t) FROM public.ai_conversations t UNION ALL SELECT 'call_transcripts',id,to_jsonb(t) FROM public.call_transcripts t UNION ALL SELECT 'call_intelligence',id,to_jsonb(t) FROM public.call_intelligence t UNION ALL SELECT 'chat_conversations',id,to_jsonb(t) FROM public.chat_conversations t UNION ALL SELECT 'chat_messages',id,to_jsonb(t) FROM public.chat_messages t UNION ALL SELECT 'chat_leads',id,to_jsonb(t) FROM public.chat_leads t UNION ALL SELECT 'chat_callbacks',id,to_jsonb(t) FROM public.chat_callbacks t;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_bookings_provider_uidx ON public.calendar_bookings(workspace_id,calendar_id,event_id);
CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_session_uidx ON public.chat_conversations(session_id);
ALTER TABLE public.chat_messages ADD COLUMN turn_index integer;
WITH numbered AS (SELECT id,row_number() OVER (PARTITION BY conversation_id ORDER BY created_at,id)-1 AS position FROM public.chat_messages WHERE role <> 'tool') UPDATE public.chat_messages m SET turn_index=n.position FROM numbered n WHERE m.id=n.id;
CREATE UNIQUE INDEX chat_messages_turn_uidx ON public.chat_messages(conversation_id,turn_index);
CREATE FUNCTION public.save_concierge_transcript(p_conversation_id uuid,p_turns jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
PERFORM 1 FROM public.chat_conversations WHERE id=p_conversation_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
IF jsonb_array_length(p_turns)=0 THEN RETURN; END IF;
INSERT INTO public.chat_messages(conversation_id,role,content,at_seconds,turn_index)
SELECT p_conversation_id,t.value->>'role',t.value->>'content',(t.value->>'at')::numeric,t.ordinality-1 FROM jsonb_array_elements(p_turns) WITH ORDINALITY t(value,ordinality)
ON CONFLICT(conversation_id,turn_index) DO UPDATE SET role=EXCLUDED.role,content=EXCLUDED.content,at_seconds=EXCLUDED.at_seconds;
DELETE FROM public.chat_messages WHERE conversation_id=p_conversation_id AND turn_index >= jsonb_array_length(p_turns);
END;
$$;
REVOKE ALL ON FUNCTION public.save_concierge_transcript(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_concierge_transcript(uuid,jsonb) TO service_role;