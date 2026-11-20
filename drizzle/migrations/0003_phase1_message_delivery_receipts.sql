CREATE TABLE public.message_delivery_receipts(sid text PRIMARY KEY,status text NOT NULL,error_code text,updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.message_delivery_receipts TO service_role;
ALTER TABLE public.message_delivery_receipts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.record_message_delivery(p_sid text,p_status text,p_error text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF p_status NOT IN ('accepted','scheduled','queued','sending','sent','delivered','read','undelivered','failed','canceled') THEN RAISE EXCEPTION 'Invalid message status'; END IF;
INSERT INTO public.message_delivery_receipts(sid,status,error_code) VALUES(p_sid,p_status,p_error) ON CONFLICT(sid) DO UPDATE SET status=EXCLUDED.status,error_code=EXCLUDED.error_code,updated_at=now() WHERE message_delivery_receipts.status NOT IN ('delivered','read','undelivered','failed','canceled') OR EXCLUDED.status IN ('delivered','read','undelivered','failed','canceled');
UPDATE public.messages m SET status=r.status,error_code=r.error_code FROM public.message_delivery_receipts r WHERE m.sid=p_sid AND r.sid=p_sid AND m.direction='outbound'; END; $$;
REVOKE ALL ON FUNCTION public.record_message_delivery(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_message_delivery(text,text,text) TO service_role;
CREATE FUNCTION public.apply_pending_message_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE receipt public.message_delivery_receipts; BEGIN IF NEW.direction='outbound' THEN SELECT * INTO receipt FROM public.message_delivery_receipts WHERE sid=NEW.sid; IF FOUND THEN NEW.status:=receipt.status;NEW.error_code:=receipt.error_code; END IF; END IF; RETURN NEW; END; $$;
CREATE TRIGGER apply_pending_message_delivery BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.apply_pending_message_delivery();
REVOKE ALL ON FUNCTION public.apply_pending_message_delivery() FROM PUBLIC,anon,authenticated;