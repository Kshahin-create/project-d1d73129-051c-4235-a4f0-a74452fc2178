
-- Fix has_role: remove self-check restriction so it works for any user id passed
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Tighten interested_customers insert policy: require staff role and bind created_by to auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert interested" ON public.interested_customers;

CREATE POLICY "Staff can insert interested"
ON public.interested_customers
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  AND COALESCE(source, 'manual') = ANY (ARRAY['web','manual','telegram'])
);
