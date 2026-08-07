-- 1. MMS media: owner / admin / line-owner scoped reads
DROP POLICY IF EXISTS "authenticated can read mms media" ON storage.objects;
CREATE POLICY "mms media readable by owner or line owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'mms-media'
  AND (
    owner = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.can_see_number(auth.uid(), (storage.foldername(name))[1])
  )
);

DROP POLICY IF EXISTS "authenticated can upload mms media" ON storage.objects;
CREATE POLICY "mms media upload by owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mms-media' AND owner = auth.uid());

-- 2. Definer helpers: only answer about the caller when invoked by a signed-in user
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin','owner','admin')
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND (auth.uid() IS NULL OR _user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_see_number(_user_id uuid, _number text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.phone_numbers p
        WHERE p.phone_number = _number AND p.assigned_to = _user_id
      )
    )
$$;

-- 3. Helpers only used by server code: not callable from the app
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_see_number(uuid, text) FROM anon;