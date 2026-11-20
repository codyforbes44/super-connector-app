DROP POLICY IF EXISTS plan_limits_select ON public.plan_limits;
CREATE POLICY plan_limits_select ON public.plan_limits
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));