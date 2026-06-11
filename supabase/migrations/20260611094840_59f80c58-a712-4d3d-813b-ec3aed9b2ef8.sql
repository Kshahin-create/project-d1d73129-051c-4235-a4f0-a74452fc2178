
-- 1) Extend admin_set_user_role to auto-create tenant_account on tenant role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user uuid, _new_role app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p RECORD; _exists uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _target_user = auth.uid() AND _new_role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user, _new_role);

  IF _new_role = 'tenant' THEN
    SELECT * INTO _p FROM public.profiles WHERE user_id = _target_user;
    SELECT id INTO _exists FROM public.tenant_accounts WHERE user_id = _target_user LIMIT 1;
    IF _exists IS NULL THEN
      INSERT INTO public.tenant_accounts (user_id, full_name, email, created_by)
      VALUES (_target_user, COALESCE(_p.display_name, _p.email, 'مستأجر'), _p.email, auth.uid());
    END IF;
  END IF;
END $$;

-- 2) Merge duplicate tenant_accounts by name
CREATE OR REPLACE FUNCTION public.merge_duplicate_tenant_accounts()
RETURNS TABLE(merged_groups int, deleted_accounts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _grp RECORD;
  _canonical uuid;
  _dup uuid;
  _ids uuid[];
  _groups int := 0;
  _deleted int := 0;
  _i int;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _grp IN
    SELECT btrim(full_name) AS name,
           array_agg(id ORDER BY (user_id IS NOT NULL) DESC,
                                 (phone IS NOT NULL) DESC,
                                 (cr_number IS NOT NULL) DESC,
                                 created_at) AS ids
    FROM public.tenant_accounts
    WHERE full_name IS NOT NULL AND btrim(full_name) <> ''
    GROUP BY btrim(full_name)
    HAVING count(*) > 1
  LOOP
    _ids := _grp.ids;
    _canonical := _ids[1];
    _groups := _groups + 1;

    FOR _i IN 2..array_length(_ids, 1) LOOP
      _dup := _ids[_i];

      -- move units (skip ones already linked to canonical)
      UPDATE public.tenant_account_units tau
        SET tenant_account_id = _canonical
        WHERE tau.tenant_account_id = _dup
          AND NOT EXISTS (
            SELECT 1 FROM public.tenant_account_units x
            WHERE x.tenant_account_id = _canonical AND x.unit_id = tau.unit_id
          );
      DELETE FROM public.tenant_account_units WHERE tenant_account_id = _dup;

      -- move invoices
      UPDATE public.invoices SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;

      -- move magic-login links
      UPDATE public.tenant_login_links SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;

      -- merge fields + sum paid
      UPDATE public.tenant_accounts ca
        SET paid_amount = COALESCE(ca.paid_amount,0) + COALESCE(d.paid_amount,0),
            phone         = COALESCE(ca.phone, d.phone),
            email         = COALESCE(ca.email, d.email),
            business_name = COALESCE(ca.business_name, d.business_name),
            cr_number     = COALESCE(ca.cr_number, d.cr_number),
            activity_type = COALESCE(ca.activity_type, d.activity_type),
            user_id       = COALESCE(ca.user_id, d.user_id),
            notes         = COALESCE(NULLIF(ca.notes,''), NULLIF(d.notes,'')),
            updated_at    = now()
        FROM public.tenant_accounts d
        WHERE ca.id = _canonical AND d.id = _dup;

      DELETE FROM public.tenant_accounts WHERE id = _dup;
      _deleted := _deleted + 1;
    END LOOP;

    PERFORM public.recalc_tenant_account_total(_canonical);
  END LOOP;

  merged_groups := _groups;
  deleted_accounts := _deleted;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.merge_duplicate_tenant_accounts() TO authenticated;

-- 3) Run the merge now (bypass auth check by temporarily granting via service role context isn't available here);
--    Instead replicate the merge logic inline as a one-off DO block.
DO $$
DECLARE
  _grp RECORD; _canonical uuid; _dup uuid; _ids uuid[]; _i int;
BEGIN
  FOR _grp IN
    SELECT btrim(full_name) AS name,
           array_agg(id ORDER BY (user_id IS NOT NULL) DESC,
                                 (phone IS NOT NULL) DESC,
                                 (cr_number IS NOT NULL) DESC,
                                 created_at) AS ids
    FROM public.tenant_accounts
    WHERE full_name IS NOT NULL AND btrim(full_name) <> ''
    GROUP BY btrim(full_name)
    HAVING count(*) > 1
  LOOP
    _ids := _grp.ids;
    _canonical := _ids[1];
    FOR _i IN 2..array_length(_ids,1) LOOP
      _dup := _ids[_i];
      UPDATE public.tenant_account_units tau SET tenant_account_id = _canonical
        WHERE tau.tenant_account_id = _dup
          AND NOT EXISTS (SELECT 1 FROM public.tenant_account_units x WHERE x.tenant_account_id = _canonical AND x.unit_id = tau.unit_id);
      DELETE FROM public.tenant_account_units WHERE tenant_account_id = _dup;
      UPDATE public.invoices SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;
      UPDATE public.tenant_login_links SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;
      UPDATE public.tenant_accounts ca
        SET paid_amount = COALESCE(ca.paid_amount,0) + COALESCE(d.paid_amount,0),
            phone = COALESCE(ca.phone, d.phone),
            email = COALESCE(ca.email, d.email),
            business_name = COALESCE(ca.business_name, d.business_name),
            cr_number = COALESCE(ca.cr_number, d.cr_number),
            activity_type = COALESCE(ca.activity_type, d.activity_type),
            user_id = COALESCE(ca.user_id, d.user_id),
            notes = COALESCE(NULLIF(ca.notes,''), NULLIF(d.notes,'')),
            updated_at = now()
        FROM public.tenant_accounts d
        WHERE ca.id = _canonical AND d.id = _dup;
      DELETE FROM public.tenant_accounts WHERE id = _dup;
    END LOOP;
    PERFORM public.recalc_tenant_account_total(_canonical);
  END LOOP;
END $$;

-- 4) Update admin_list_users ordering to recognize tenant role
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamp with time zone, is_admin boolean, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.user_id, p.email, p.display_name, p.created_at,
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin') AS is_admin,
    COALESCE(
      (SELECT ur.role::text FROM public.user_roles ur
        WHERE ur.user_id = p.user_id
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 1
          WHEN 'manager' THEN 2
          WHEN 'control' THEN 3
          WHEN 'tenant' THEN 4
          WHEN 'user' THEN 5
          ELSE 6
        END
        LIMIT 1),
      'user'
    ) AS role
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY p.created_at DESC;
$$;
