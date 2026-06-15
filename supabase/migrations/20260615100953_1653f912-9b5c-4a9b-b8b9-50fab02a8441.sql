
-- 1) Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2) Restrict app_settings: only admins/managers can read full row
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Admins read app settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Public maintenance status helper (only returns the two non-sensitive fields)
CREATE OR REPLACE FUNCTION public.get_maintenance_status()
RETURNS TABLE(maintenance_mode boolean, maintenance_message text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT maintenance_mode, maintenance_message FROM public.app_settings WHERE id = 1
$$;
REVOKE ALL ON FUNCTION public.get_maintenance_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maintenance_status() TO anon, authenticated;

-- 3) Remove broad listing policies on public storage buckets (direct URLs still work)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Email assets are publicly readable" ON storage.objects;
