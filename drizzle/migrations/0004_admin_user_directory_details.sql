CREATE OR REPLACE FUNCTION public.admin_user_directory()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'غير مسموح بعرض بيانات المستخدمين' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC)
    FROM (
      SELECT r.*, COALESCE(NULLIF(trim(c.full_name), ''), NULLIF(trim(r.display_name), '')) AS full_name,
        COALESCE(NULLIF(c.phone, ''), NULLIF(a.phone, '')) AS phone,
        COALESCE(NULLIF(c.email, ''), NULLIF(a.email, ''), r.email) AS contact_email,
        c.avatar_url, c.business_name, c.activity_type, c.notes,
        c.updated_at AS profile_updated_at, a.last_sign_in_at,
        l.ip_address, l.country, l.region, l.city, l.isp, l.user_agent,
        l.created_at AS access_recorded_at, l.event AS access_event
      FROM public.admin_list_users() r
      LEFT JOIN auth.users a ON a.id = r.user_id
      LEFT JOIN LATERAL (
        SELECT cp.* FROM public.customer_profiles cp WHERE cp.user_id = r.user_id
        ORDER BY cp.updated_at DESC, cp.id LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT al.* FROM public.access_log al
        WHERE al.user_id = r.user_id AND al.event IN ('sign_in', 'signup')
        ORDER BY al.created_at DESC, al.id LIMIT 1
      ) l ON true
    ) d
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
COMMENT ON FUNCTION public.admin_user_directory() IS 'Admin-only contact/profile directory. Location is the latest recorded access location, not verified identity or nationality. No authentication secrets are returned.';