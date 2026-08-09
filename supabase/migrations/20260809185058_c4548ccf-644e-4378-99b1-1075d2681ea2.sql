REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.can_see_number(uuid, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_see_number(uuid, text) TO service_role;