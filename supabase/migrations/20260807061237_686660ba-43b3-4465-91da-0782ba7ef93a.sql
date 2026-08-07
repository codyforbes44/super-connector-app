-- CONTACTS: add ownership
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS owner_id uuid;
UPDATE public.contacts SET owner_id = (SELECT user_id FROM public.user_roles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1) WHERE owner_id IS NULL;
ALTER TABLE public.contacts ALTER COLUMN owner_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS contacts_owner_id_idx ON public.contacts(owner_id);

DROP POLICY IF EXISTS "contacts readable" ON public.contacts;
DROP POLICY IF EXISTS "contacts writable" ON public.contacts;
CREATE POLICY "contacts readable by owner or admin" ON public.contacts
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "contacts writable by owner or admin" ON public.contacts
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- PHONE NUMBERS
DROP POLICY IF EXISTS "numbers readable" ON public.phone_numbers;
CREATE POLICY "numbers readable by assignee or admin" ON public.phone_numbers
  FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR public.is_admin(auth.uid()));

-- PROFILES
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by self or admin" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- USER ROLES
DROP POLICY IF EXISTS "roles readable by authenticated" ON public.user_roles;
CREATE POLICY "roles readable by self or admin" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- CALLER ID ROUTES
DROP POLICY IF EXISTS "members read caller id routes" ON public.caller_id_routes;
CREATE POLICY "admins read caller id routes" ON public.caller_id_routes
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- TWIML APPS
DROP POLICY IF EXISTS "twiml apps readable" ON public.twiml_apps;
CREATE POLICY "admins read twiml apps" ON public.twiml_apps
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- EMAIL TEMPLATE OVERRIDES
DROP POLICY IF EXISTS "read templates" ON public.email_template_overrides;
CREATE POLICY "admins read email template overrides" ON public.email_template_overrides
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- MESSAGE TEMPLATES
DROP POLICY IF EXISTS "templates readable" ON public.templates;
CREATE POLICY "templates readable by owner or admin" ON public.templates
  FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- APP USER CONNECTIONS: server-only by design; make grants explicit
REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;

-- SECURITY DEFINER function exposure
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_super_admin_for_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_number(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;