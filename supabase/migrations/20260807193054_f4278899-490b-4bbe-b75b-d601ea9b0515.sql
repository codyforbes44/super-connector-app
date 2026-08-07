CREATE TABLE public.byo_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_number text NOT NULL,
  carrier text,
  forward_mode text NOT NULL DEFAULT 'conditional',
  assigned_number text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamp with time zone,
  last_forwarded_call_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.byo_numbers TO authenticated;
GRANT ALL ON public.byo_numbers TO service_role;

ALTER TABLE public.byo_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view forwarding setups"
ON public.byo_numbers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners and admins can create forwarding setups"
ON public.byo_numbers FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners and admins can update forwarding setups"
ON public.byo_numbers FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owners and admins can delete forwarding setups"
ON public.byo_numbers FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER update_byo_numbers_updated_at
BEFORE UPDATE ON public.byo_numbers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS setup_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS support_requested_at timestamp with time zone;