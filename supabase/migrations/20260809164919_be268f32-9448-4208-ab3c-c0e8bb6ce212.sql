CREATE TABLE public.a2p_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaign_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  messaging_service_sid text,
  customer_profile_sid text,
  end_user_sid text,
  address_sid text,
  document_sid text,
  trust_product_sid text,
  brand_sid text,
  brand_status text,
  campaign_sid text,
  campaign_status text,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.a2p_registrations TO authenticated;
GRANT ALL ON public.a2p_registrations TO service_role;

ALTER TABLE public.a2p_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "a2p owner or admin can read"
ON public.a2p_registrations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "a2p owner can write"
ON public.a2p_registrations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "a2p owner can update"
ON public.a2p_registrations FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_a2p_registrations_updated_at
BEFORE UPDATE ON public.a2p_registrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();