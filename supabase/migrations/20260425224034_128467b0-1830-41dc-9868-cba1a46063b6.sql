-- Fix 1: Restrict units SELECT to admins only
DROP POLICY IF EXISTS "Anyone can view units" ON public.units;
CREATE POLICY "Admins view units"
  ON public.units FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Restrict buildings SELECT to admins only (removes revenue exposure)
DROP POLICY IF EXISTS "Authenticated users can view buildings" ON public.buildings;
CREATE POLICY "Admins view buildings"
  ON public.buildings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Fix 3: Harden has_role function — deny role lookups for spoofed UUIDs
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND _user_id = auth.uid()
  )
$$;