-- Revoke execute from authenticated on SECURITY DEFINER helpers that are not
-- referenced by any RLS policy or application code.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO service_role;

-- Re-assert self-scoping on the helpers that RLS policies must be able to call.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','owner','admin')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_see_number(_user_id uuid, _number text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id = auth.uid()
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.phone_numbers p
        WHERE p.phone_number = _number AND p.assigned_to = _user_id
      )
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_see_number(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_number(uuid, text) TO authenticated, service_role;