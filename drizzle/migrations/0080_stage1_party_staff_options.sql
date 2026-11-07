-- Staff list for the optional customer owner picker (names only).
CREATE OR REPLACE FUNCTION public.party_staff_options()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.has_permission('customers.names','view') THEN '[]'::jsonb ELSE coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'name') FROM (
      SELECT DISTINCT ON (p.user_id) jsonb_build_object('user_id', p.user_id, 'name', coalesce(nullif(p.display_name,''), 'موظف'), 'role', a.role) AS x
      FROM public.profiles p JOIN public.user_role_assignments a ON a.user_id = p.user_id
      WHERE a.is_active AND a.role IN ('admin','leasing_manager','sales_agent') AND public.task_staff_active(p.user_id)
      ORDER BY p.user_id, CASE a.role WHEN 'sales_agent' THEN 0 WHEN 'leasing_manager' THEN 1 ELSE 2 END) s), '[]'::jsonb) END
$$;
REVOKE ALL ON FUNCTION public.party_staff_options() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.party_staff_options() TO authenticated;
SELECT 'party_staff_options ready' AS status;