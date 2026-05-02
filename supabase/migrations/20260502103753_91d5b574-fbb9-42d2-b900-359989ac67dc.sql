DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamp with time zone, is_admin boolean, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    p.created_at,
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'admin'
    ) AS is_admin,
    COALESCE(
      (SELECT ur.role::text FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 1
          WHEN 'control' THEN 2
          WHEN 'user' THEN 3
          ELSE 4
        END
        LIMIT 1),
      'user'
    ) AS role
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user uuid, _new_role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _target_user = auth.uid() AND _new_role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user, _new_role);
END;
$function$;

CREATE POLICY "Control view units"
ON public.units
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'control'));

CREATE POLICY "Control update units"
ON public.units
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'control'))
WITH CHECK (public.has_role(auth.uid(), 'control'));
