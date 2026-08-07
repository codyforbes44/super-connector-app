CREATE TABLE IF NOT EXISTS public.caller_id_verifications (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  friendly_name text,
  status text not null default 'pending',
  validation_code text,
  call_sid text,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caller_id_verifications TO authenticated;
GRANT ALL ON public.caller_id_verifications TO service_role;
ALTER TABLE public.caller_id_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage caller id verifications" ON public.caller_id_verifications;
CREATE POLICY "admins manage caller id verifications" ON public.caller_id_verifications
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS update_caller_id_verifications_updated_at ON public.caller_id_verifications;
CREATE TRIGGER update_caller_id_verifications_updated_at BEFORE UPDATE ON public.caller_id_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.caller_id_routes (
  id uuid primary key default gen_random_uuid(),
  pattern text not null unique,
  caller_id text not null,
  label text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caller_id_routes TO authenticated;
GRANT ALL ON public.caller_id_routes TO service_role;
ALTER TABLE public.caller_id_routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read caller id routes" ON public.caller_id_routes;
CREATE POLICY "members read caller id routes" ON public.caller_id_routes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins manage caller id routes" ON public.caller_id_routes;
CREATE POLICY "admins manage caller id routes" ON public.caller_id_routes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP TRIGGER IF EXISTS update_caller_id_routes_updated_at ON public.caller_id_routes;
CREATE TRIGGER update_caller_id_routes_updated_at BEFORE UPDATE ON public.caller_id_routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS outbound_caller_id text;