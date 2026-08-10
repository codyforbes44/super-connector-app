CREATE TABLE public.webhook_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'twilio',
  error_code text,
  message text,
  url text,
  call_sid text,
  app_number text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.webhook_errors TO authenticated;
GRANT ALL ON public.webhook_errors TO service_role;

ALTER TABLE public.webhook_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read webhook errors"
ON public.webhook_errors FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX webhook_errors_created_at_idx ON public.webhook_errors (created_at DESC);
CREATE INDEX webhook_errors_call_sid_idx ON public.webhook_errors (call_sid);