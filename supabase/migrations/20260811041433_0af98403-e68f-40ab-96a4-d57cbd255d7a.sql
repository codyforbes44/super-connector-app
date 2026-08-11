CREATE TABLE public.esim_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'airalo',
  package_id text NOT NULL,
  package_title text NOT NULL,
  region text,
  data_amount text,
  validity_days integer,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  environment text NOT NULL DEFAULT 'live',
  stripe_session_id text UNIQUE,
  stripe_payment_intent text,
  provider_order_id text,
  iccid text,
  activation_code text,
  matching_id text,
  smdp_address text,
  qr_code_url text,
  apn text,
  instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.esim_orders TO authenticated;
GRANT ALL ON public.esim_orders TO service_role;

ALTER TABLE public.esim_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own eSIM orders"
  ON public.esim_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create their own eSIM orders"
  ON public.esim_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX esim_orders_user_created_idx ON public.esim_orders (user_id, created_at DESC);

CREATE TRIGGER update_esim_orders_updated_at
  BEFORE UPDATE ON public.esim_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();