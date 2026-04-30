-- Function for admin to list all users with their roles
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  is_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.email,
    p.display_name,
    p.created_at,
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.user_id AND ur.role = 'admin'
    ) AS is_admin
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC;
$$;

-- Function for admin to grant admin role
CREATE OR REPLACE FUNCTION public.admin_set_role(_target_user uuid, _make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _target_user = auth.uid() AND NOT _make_admin THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;

  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, 'admin')
    ON CONFLICT DO NOTHING;
    -- Remove plain user role if exists
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = 'user';
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target_user AND role = 'admin';
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Allow admins to view all profiles (currently they cannot - only own)
CREATE POLICY "Admins view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete tenants
CREATE POLICY "Admins delete tenants"
ON public.tenants
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));