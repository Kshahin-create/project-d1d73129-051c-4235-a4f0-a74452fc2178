
-- 1) Add merge tracking columns
ALTER TABLE public.tenant_accounts
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.tenant_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE INDEX IF NOT EXISTS idx_tenant_accounts_merged_into ON public.tenant_accounts(merged_into);

-- 2) Merge function: move all relations from duplicate ids into canonical
CREATE OR REPLACE FUNCTION public.admin_merge_tenant_accounts(
  _canonical_id uuid,
  _duplicate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dup uuid;
  _moved_units int := 0;
  _moved_invoices int := 0;
  _moved_collections int := 0;
  _moved_files int := 0;
  _moved_bookings int := 0;
  _moved_logins int := 0;
  _sum_paid numeric := 0;
  _canonical public.tenant_accounts;
  _dup_row public.tenant_accounts;
  _n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _canonical_id IS NULL OR _duplicate_ids IS NULL OR array_length(_duplicate_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'معطيات غير صالحة';
  END IF;

  SELECT * INTO _canonical FROM public.tenant_accounts WHERE id = _canonical_id AND merged_into IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'السجل الرئيسي غير موجود أو مدمج مسبقاً';
  END IF;

  FOREACH _dup IN ARRAY _duplicate_ids LOOP
    IF _dup = _canonical_id THEN CONTINUE; END IF;

    SELECT * INTO _dup_row FROM public.tenant_accounts WHERE id = _dup;
    IF NOT FOUND OR _dup_row.merged_into IS NOT NULL THEN CONTINUE; END IF;

    -- Move tenant_account_units (dedupe by unit)
    UPDATE public.tenant_account_units tau
      SET tenant_account_id = _canonical_id
      WHERE tau.tenant_account_id = _dup
        AND NOT EXISTS (
          SELECT 1 FROM public.tenant_account_units x
          WHERE x.tenant_account_id = _canonical_id AND x.unit_id = tau.unit_id
        );
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_units := _moved_units + _n;
    DELETE FROM public.tenant_account_units WHERE tenant_account_id = _dup;

    -- Move invoices
    UPDATE public.invoices SET tenant_account_id = _canonical_id WHERE tenant_account_id = _dup;
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_invoices := _moved_invoices + _n;

    -- Move unit_collections
    UPDATE public.unit_collections SET tenant_account_id = _canonical_id WHERE tenant_account_id = _dup;
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_collections := _moved_collections + _n;

    -- Move files
    UPDATE public.tenant_account_files SET tenant_account_id = _canonical_id WHERE tenant_account_id = _dup;
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_files := _moved_files + _n;

    -- Move bookings.previous_tenant_account_id
    UPDATE public.bookings SET previous_tenant_account_id = _canonical_id WHERE previous_tenant_account_id = _dup;
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_bookings := _moved_bookings + _n;

    -- Move login links
    UPDATE public.tenant_login_links SET tenant_account_id = _canonical_id WHERE tenant_account_id = _dup;
    GET DIAGNOSTICS _n = ROW_COUNT; _moved_logins := _moved_logins + _n;

    -- Backfill missing canonical fields from duplicate
    UPDATE public.tenant_accounts ca SET
        phone = COALESCE(NULLIF(btrim(coalesce(ca.phone,'')),''), _dup_row.phone),
        email = COALESCE(NULLIF(btrim(coalesce(ca.email,'')),''), _dup_row.email),
        business_name = COALESCE(NULLIF(btrim(coalesce(ca.business_name,'')),''), _dup_row.business_name),
        cr_number = COALESCE(NULLIF(btrim(coalesce(ca.cr_number,'')),''), _dup_row.cr_number),
        activity_type = COALESCE(NULLIF(btrim(coalesce(ca.activity_type,'')),''), _dup_row.activity_type),
        user_id = COALESCE(ca.user_id, _dup_row.user_id),
        notes = COALESCE(NULLIF(btrim(coalesce(ca.notes,'')),''), _dup_row.notes),
        paid_amount = COALESCE(ca.paid_amount,0) + COALESCE(_dup_row.paid_amount,0),
        updated_at = now()
      WHERE ca.id = _canonical_id;

    _sum_paid := _sum_paid + COALESCE(_dup_row.paid_amount, 0);

    -- Mark duplicate as merged (keep row for audit)
    UPDATE public.tenant_accounts SET
        merged_into = _canonical_id,
        merged_at = now(),
        merged_by = auth.uid(),
        notes = COALESCE(notes,'') || E'\n[مدمج في ' || _canonical_id::text || ' بتاريخ ' || to_char(now(),'YYYY-MM-DD HH24:MI') || ']',
        updated_at = now()
      WHERE id = _dup;
  END LOOP;

  -- Recalculate totals from unit links
  PERFORM public.recalc_tenant_account_total(_canonical_id);

  -- Audit log entry
  INSERT INTO public.audit_log (
    actor_id, action, entity_table, entity_id,
    after_data, context
  ) VALUES (
    auth.uid(), 'MERGE', 'tenant_accounts', _canonical_id::text,
    jsonb_build_object(
      'canonical_id', _canonical_id,
      'canonical_name', _canonical.full_name,
      'duplicate_ids', to_jsonb(_duplicate_ids),
      'moved_units', _moved_units,
      'moved_invoices', _moved_invoices,
      'moved_collections', _moved_collections,
      'moved_files', _moved_files,
      'moved_bookings', _moved_bookings,
      'moved_logins', _moved_logins,
      'summed_paid', _sum_paid
    ),
    jsonb_build_object('operation','tenant_merge')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'canonical_id', _canonical_id,
    'moved_units', _moved_units,
    'moved_invoices', _moved_invoices,
    'moved_collections', _moved_collections,
    'moved_files', _moved_files,
    'moved_bookings', _moved_bookings,
    'moved_logins', _moved_logins,
    'summed_paid', _sum_paid
  );
END;
$$;

-- 3) Auto-detect + merge duplicates by normalized full_name OR business_name (exact match after normalization)
CREATE OR REPLACE FUNCTION public.admin_auto_merge_duplicate_tenants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _grp RECORD;
  _canonical uuid;
  _dups uuid[];
  _groups int := 0;
  _merged int := 0;
  _res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _grp IN
    WITH norm AS (
      SELECT id, paid_amount, cr_number, user_id, phone, created_at,
        NULLIF(regexp_replace(lower(btrim(coalesce(full_name,''))), '[[:space:][:punct:]]+', ' ', 'g'), '') AS n_name,
        NULLIF(regexp_replace(lower(btrim(coalesce(business_name,''))), '[[:space:][:punct:]]+', ' ', 'g'), '') AS n_biz
      FROM public.tenant_accounts
      WHERE merged_into IS NULL
    ),
    keyed AS (
      SELECT id, paid_amount, cr_number, user_id, phone, created_at, 'name:'||n_name AS k FROM norm WHERE n_name IS NOT NULL
      UNION ALL
      SELECT id, paid_amount, cr_number, user_id, phone, created_at, 'biz:'||n_biz  AS k FROM norm WHERE n_biz  IS NOT NULL
    )
    SELECT k,
      array_agg(id ORDER BY (user_id IS NOT NULL) DESC, (cr_number IS NOT NULL) DESC,
                            (phone IS NOT NULL) DESC, paid_amount DESC, created_at) AS ids
    FROM keyed
    GROUP BY k
    HAVING count(DISTINCT id) > 1
  LOOP
    _canonical := _grp.ids[1];
    _dups := _grp.ids[2:array_length(_grp.ids,1)];

    -- Skip if canonical already merged by a previous group iteration
    IF EXISTS (SELECT 1 FROM public.tenant_accounts WHERE id = _canonical AND merged_into IS NULL) THEN
      _res := public.admin_merge_tenant_accounts(_canonical, _dups);
      _groups := _groups + 1;
      _merged := _merged + array_length(_dups,1);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('groups', _groups, 'merged_duplicates', _merged);
END;
$$;

-- 4) Update list function to exclude merged tenants
CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
 RETURNS TABLE(id uuid, user_id uuid, full_name text, phone text, email text, business_name text, activity_type text, notes text, total_price numeric, paid_amount numeric, created_at timestamp with time zone, units_count bigint, unpaid_invoices bigint, unpaid_total numeric, has_login boolean, cr_number text, files_count bigint, collected_total numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ta.id,
    ta.user_id,
    ta.full_name,
    ta.phone,
    ta.email,
    ta.business_name,
    ta.activity_type,
    ta.notes,
    ta.total_price,
    ta.paid_amount,
    ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units u WHERE u.tenant_account_id = ta.id), 0) AS units_count,
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_invoices,
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_total,
    (ta.user_id IS NOT NULL) AS has_login,
    ta.cr_number,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_files f WHERE f.tenant_account_id = ta.id AND f.is_archived = false), 0) AS files_count,
    COALESCE((SELECT SUM(c.amount) FROM public.unit_collections c WHERE c.tenant_account_id = ta.id AND c.is_archived = false), 0) AS collected_total
  FROM public.tenant_accounts ta
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND ta.merged_into IS NULL
  ORDER BY ta.created_at DESC;
$function$;
