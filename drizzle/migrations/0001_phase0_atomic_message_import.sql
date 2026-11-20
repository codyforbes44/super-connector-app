CREATE FUNCTION public.import_history_message(p_message jsonb) RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE thread_id uuid; inserted_count integer; latest public.messages;
BEGIN
IF nullif(p_message->>'sid','') IS NULL OR nullif(p_message->>'from_number','') IS NULL OR nullif(p_message->>'to_number','') IS NULL THEN RAISE EXCEPTION 'Missing message identity or phone number'; END IF;
IF coalesce(trim(p_message->>'body'),'')='' AND jsonb_array_length(coalesce(p_message->'media','[]'::jsonb))=0 THEN RETURN 0; END IF;
IF EXISTS(SELECT 1 FROM public.messages WHERE sid=p_message->>'sid') THEN RETURN 0; END IF;
INSERT INTO public.conversations(workspace_id,channel,app_number,contact_number)
VALUES ((p_message->>'workspace_id')::uuid,p_message->>'channel',p_message->>'app_number',p_message->>'contact_number')
ON CONFLICT(workspace_id,channel,app_number,contact_number) DO UPDATE SET app_number=EXCLUDED.app_number RETURNING id INTO thread_id;
INSERT INTO public.messages(conversation_id,sid,direction,channel,from_number,to_number,body,status,price,media,created_at,workspace_id)
VALUES(thread_id,p_message->>'sid',p_message->>'direction',p_message->>'channel',p_message->>'from_number',p_message->>'to_number',p_message->>'body',p_message->>'status',(p_message->>'price')::numeric,coalesce(p_message->'media','[]'::jsonb),(p_message->>'created_at')::timestamptz,(p_message->>'workspace_id')::uuid)
ON CONFLICT(sid) DO NOTHING;
GET DIAGNOSTICS inserted_count=ROW_COUNT;
SELECT * INTO latest FROM public.messages WHERE conversation_id=thread_id ORDER BY created_at DESC,id DESC LIMIT 1;
IF FOUND THEN UPDATE public.conversations SET last_message_at=latest.created_at,last_message_preview=left(coalesce(nullif(latest.body,''),'[media]'),140) WHERE id=thread_id; END IF;
RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.import_history_message(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.import_history_message(jsonb) TO service_role;