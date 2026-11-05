-- ===== 1. Archive columns on record tables =====
ALTER TABLE public.leads                ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.interested_customers ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.customer_profiles    ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.tenant_accounts      ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.bookings             ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.invoices             ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;
ALTER TABLE public.unit_collections     ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archived_by uuid, ADD COLUMN IF NOT EXISTS archive_reason text;

-- Reversal links
ALTER TABLE public.invoices         ADD COLUMN IF NOT EXISTS reverses_id uuid REFERENCES public.invoices(id), ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE public.unit_collections ADD COLUMN IF NOT EXISTS reverses_id uuid REFERENCES public.unit_collections(id), ADD COLUMN IF NOT EXISTS reversal_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_reversal ON public.invoices(reverses_id) WHERE reverses_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unit_collections_one_reversal ON public.unit_collections(reverses_id) WHERE reverses_id IS NOT NULL;
ALTER TABLE public.unit_collections DROP CONSTRAINT IF EXISTS unit_collections_amount_check;
ALTER TABLE public.unit_collections ADD CONSTRAINT unit_collections_amount_check
  CHECK ((amount > 0 AND reverses_id IS NULL) OR (amount < 0 AND reverses_id IS NOT NULL));

-- Reversible merge
ALTER TABLE public.tenant_accounts
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.tenant_accounts(id),
  ADD COLUMN IF NOT EXISTS merge_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS unmerged_at timestamptz,
  ADD COLUMN IF NOT EXISTS unmerged_by uuid;
UPDATE public.tenant_accounts SET merged_into_id = merged_into WHERE merged_into IS NOT NULL AND merged_into_id IS NULL;

-- Maintenance status for units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS status_before_maintenance text;
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;
ALTER TABLE public.units ADD CONSTRAINT units_status_check CHECK (status = ANY (ARRAY['available','rented','reserved','maintenance']));

-- ===== 2. Preserved rows (link/occupancy tables) =====
CREATE TABLE IF NOT EXISTS public.archived_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid,
  row_data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid,
  archive_reason text NOT NULL
);
GRANT SELECT ON public.archived_rows TO authenticated;
GRANT ALL ON public.archived_rows TO service_role;
ALTER TABLE public.archived_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers view archived rows" ON public.archived_rows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE INDEX IF NOT EXISTS archived_rows_lookup ON public.archived_rows(table_name, row_id);

-- Any delete on link tables is copied first, with the reason set by the calling function
CREATE OR REPLACE FUNCTION public.preserve_deleted_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.archived_rows(table_name, row_id, row_data, archived_by, archive_reason)
  VALUES (TG_TABLE_NAME, (to_jsonb(OLD)->>'id')::uuid, to_jsonb(OLD), auth.uid(),
          COALESCE(NULLIF(current_setting('app.archive_reason', true), ''), 'حذف داخلي من النظام'));
  RETURN OLD;
END; $$;

-- Record tables can never be hard-deleted
CREATE OR REPLACE FUNCTION public.block_hard_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'الحذف النهائي ممنوع على %؛ استخدم الأرشفة أو الإلغاء أو القيد العكسي', TG_TABLE_NAME USING ERRCODE = '42501';
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','tenant_account_units','booking_units'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS preserve_deleted_row ON public.%I', t);
    EXECUTE format('CREATE TRIGGER preserve_deleted_row BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.preserve_deleted_row()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['unit_collections','invoices','tenant_accounts','interested_customers','leads','customer_profiles','bookings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS block_hard_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER block_hard_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['unit_collections','invoices','tenant_accounts','tenant_account_units','tenants','interested_customers','leads','customer_profiles','bookings','booking_units'] LOOP
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated, anon', t);
  END LOOP;
END $$;

-- ===== 3. Helpers =====
CREATE OR REPLACE FUNCTION public._assert_admin_writer()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN; END IF;
  IF public.has_role(auth.uid(),'manager') AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'صلاحية المدير للعرض فقط' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._assert_reason(_reason text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF _reason IS NULL OR char_length(btrim(_reason)) < 5 THEN
    RAISE EXCEPTION 'السبب مطلوب (5 أحرف على الأقل)' USING ERRCODE = '22023';
  END IF;
  RETURN btrim(_reason);
END; $$;

CREATE OR REPLACE FUNCTION public._safety_audit(_action text, _table text, _id text, _before jsonb, _after jsonb, _reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log(actor_id, actor_email, action, entity_table, entity_id, before_data, after_data, context)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), _action, _table, _id, _before, _after,
          jsonb_build_object('reason', _reason, 'operation', lower(_action)));
$$;

-- ===== 4. Archive / unarchive records =====
CREATE OR REPLACE FUNCTION public.archive_record(_table text, _id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _before jsonb; _after jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  IF _table NOT IN ('leads','interested_customers','customer_profiles','tenant_accounts') THEN
    RAISE EXCEPTION 'جدول غير مسموح بأرشفته: %', _table;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1', _table) INTO _before USING _id;
  IF _before IS NULL THEN RAISE EXCEPTION 'السجل غير موجود'; END IF;
  IF _before->>'archived_at' IS NOT NULL THEN RAISE EXCEPTION 'السجل مؤرشف بالفعل'; END IF;
  EXECUTE format('UPDATE public.%I SET archived_at = now(), archived_by = auth.uid(), archive_reason = $2 WHERE id = $1 RETURNING to_jsonb(%I.*)', _table, _table)
    INTO _after USING _id, _r;
  PERFORM public._safety_audit('ARCHIVE', _table, _id::text, _before, _after, _r);
END; $$;

CREATE OR REPLACE FUNCTION public.unarchive_record(_table text, _id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _before jsonb; _after jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  IF _table NOT IN ('leads','interested_customers','customer_profiles','tenant_accounts') THEN
    RAISE EXCEPTION 'جدول غير مسموح: %', _table;
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1', _table) INTO _before USING _id;
  IF _before IS NULL OR _before->>'archived_at' IS NULL THEN RAISE EXCEPTION 'السجل غير مؤرشف'; END IF;
  EXECUTE format('UPDATE public.%I SET archived_at = NULL, archived_by = NULL, archive_reason = NULL WHERE id = $1 RETURNING to_jsonb(%I.*)', _table, _table)
    INTO _after USING _id;
  PERFORM public._safety_audit('UNARCHIVE', _table, _id::text, _before, _after, _r);
END; $$;

-- ===== 5. Tenant release (archive tenant row, free unit) =====
CREATE OR REPLACE FUNCTION public.archive_tenant(_unit_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _snap jsonb; _unit public.units;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT * INTO _unit FROM public.units WHERE id = _unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
  SELECT to_jsonb(t) INTO _snap FROM public.tenants t WHERE t.unit_id = _unit_id LIMIT 1;
  PERFORM set_config('app.archive_reason', _r, true);
  DELETE FROM public.tenants WHERE unit_id = _unit_id;  -- copied to archived_rows by trigger
  UPDATE public.units SET status = 'available', updated_at = now() WHERE id = _unit_id;
  PERFORM public._safety_audit('ARCHIVE', 'tenants', COALESCE(_snap->>'id', _unit_id::text), _snap, NULL, _r);
  RETURN _snap;
END; $$;

-- ===== 6. Tenant account archive (replaces edge delete) =====
CREATE OR REPLACE FUNCTION public.archive_tenant_account(_tenant_account_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.archive_record('tenant_accounts', _tenant_account_id, _reason);
END; $$;

-- ===== 7. Bookings =====
CREATE OR REPLACE FUNCTION public.cancel_booking_with_reason(_booking_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _before jsonb; _after jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT to_jsonb(b) INTO _before FROM public.bookings b WHERE id = _booking_id FOR UPDATE;
  IF _before IS NULL THEN RAISE EXCEPTION 'الحجز غير موجود'; END IF;
  UPDATE public.bookings SET status = 'cancelled', archived_at = now(), archived_by = auth.uid(),
         archive_reason = _r, updated_at = now()
   WHERE id = _booking_id RETURNING to_jsonb(bookings.*) INTO _after;
  UPDATE public.units u SET status = 'available', updated_at = now()
   WHERE u.id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id)
     AND u.status = 'reserved'
     AND NOT EXISTS (SELECT 1 FROM public.booking_units bu2 JOIN public.bookings b2 ON b2.id = bu2.booking_id
                     WHERE bu2.unit_id = u.id AND b2.id <> _booking_id AND b2.status IN ('pending','confirmed'))
     AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.unit_id = u.id AND (t.booking_id IS NULL OR t.booking_id <> _booking_id));
  PERFORM public._safety_audit('CANCEL', 'bookings', _booking_id::text, _before, _after, _r);
END; $$;

CREATE OR REPLACE FUNCTION public.remove_booking_units(_booking_id uuid, _booking_unit_ids uuid[], _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _before jsonb; _unit_ids uuid[]; _remaining int; _tp numeric; _ta numeric;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT jsonb_agg(to_jsonb(bu)), array_agg(bu.unit_id) INTO _before, _unit_ids
    FROM public.booking_units bu WHERE bu.booking_id = _booking_id AND bu.id = ANY(_booking_unit_ids);
  IF _unit_ids IS NULL THEN RAISE EXCEPTION 'لم أجد الوحدات المطلوبة داخل هذا الحجز'; END IF;
  PERFORM set_config('app.archive_reason', _r, true);
  DELETE FROM public.booking_units WHERE booking_id = _booking_id AND id = ANY(_booking_unit_ids);
  UPDATE public.units u SET status = 'available', updated_at = now()
   WHERE u.id = ANY(_unit_ids) AND u.status = 'reserved'
     AND NOT EXISTS (SELECT 1 FROM public.booking_units bu2 JOIN public.bookings b2 ON b2.id = bu2.booking_id
                     WHERE bu2.unit_id = u.id AND b2.status IN ('pending','confirmed'))
     AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.unit_id = u.id);
  SELECT count(*), COALESCE(sum(price),0), COALESCE(sum(area),0) INTO _remaining, _tp, _ta
    FROM public.booking_units WHERE booking_id = _booking_id;
  IF _remaining = 0 THEN
    UPDATE public.bookings SET status = 'cancelled', total_price = 0, total_area = 0, units_count = 0,
      archived_at = now(), archived_by = auth.uid(), archive_reason = _r, updated_at = now() WHERE id = _booking_id;
  ELSE
    UPDATE public.bookings SET total_price = _tp, total_area = _ta, units_count = _remaining, updated_at = now() WHERE id = _booking_id;
  END IF;
  PERFORM public._safety_audit('REMOVE_UNITS', 'booking_units', _booking_id::text, _before, NULL, _r);
  RETURN jsonb_build_object('removed', array_length(_unit_ids,1), 'remaining', _remaining, 'new_total_price', _tp,
                            'booking_status', CASE WHEN _remaining = 0 THEN 'cancelled' ELSE NULL END);
END; $$;

-- ===== 8. Payment reversals =====
CREATE OR REPLACE FUNCTION public.reverse_payment(_invoice_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _o public.invoices; _new uuid;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT * INTO _o FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفاتورة غير موجودة'; END IF;
  IF _o.reverses_id IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن عكس قيد عكسي'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE reverses_id = _invoice_id) THEN RAISE EXCEPTION 'تم عكس هذه الفاتورة من قبل'; END IF;
  INSERT INTO public.invoices (tenant_account_id, booking_id, unit_id, amount, paid_amount, paid, paid_at, notes, created_by,
    invoice_number, payment_method, customer_name, customer_phone, customer_business, cr_number, reverses_id, reversal_reason)
  VALUES (_o.tenant_account_id, _o.booking_id, _o.unit_id, -_o.amount, -COALESCE(_o.paid_amount,0), true, now(),
    'قيد عكسي للفاتورة ' || COALESCE(_o.invoice_number, _o.id::text) || ' — ' || _r, auth.uid(),
    public.next_invoice_number(), _o.payment_method, _o.customer_name, _o.customer_phone, _o.customer_business, _o.cr_number, _o.id, _r)
  RETURNING id INTO _new;
  IF COALESCE(_o.paid_amount,0) > 0 THEN
    IF _o.booking_id IS NOT NULL THEN
      UPDATE public.bookings SET paid_amount = GREATEST(COALESCE(paid_amount,0) - _o.paid_amount, 0), updated_at = now() WHERE id = _o.booking_id;
    END IF;
    IF _o.tenant_account_id IS NOT NULL THEN
      UPDATE public.tenant_accounts SET paid_amount = GREATEST(COALESCE(paid_amount,0) - _o.paid_amount, 0), updated_at = now() WHERE id = _o.tenant_account_id;
    END IF;
  END IF;
  PERFORM public._safety_audit('REVERSE', 'invoices', _invoice_id::text, to_jsonb(_o),
    (SELECT to_jsonb(i) FROM public.invoices i WHERE id = _new), _r);
  RETURN _new;
END; $$;

CREATE OR REPLACE FUNCTION public.reverse_collection(_collection_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _o public.unit_collections; _new uuid;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT * INTO _o FROM public.unit_collections WHERE id = _collection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الدفعة غير موجودة'; END IF;
  IF _o.reverses_id IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن عكس قيد عكسي'; END IF;
  IF EXISTS (SELECT 1 FROM public.unit_collections WHERE reverses_id = _collection_id) THEN RAISE EXCEPTION 'تم عكس هذه الدفعة من قبل'; END IF;
  INSERT INTO public.unit_collections (unit_id, tenant_account_id, amount, is_archived, created_by, reverses_id, reversal_reason)
  VALUES (_o.unit_id, _o.tenant_account_id, -_o.amount, _o.is_archived, auth.uid(), _o.id, _r)
  RETURNING id INTO _new;
  PERFORM public._safety_audit('REVERSE', 'unit_collections', _collection_id::text, to_jsonb(_o),
    (SELECT to_jsonb(c) FROM public.unit_collections c WHERE id = _new), _r);
  RETURN _new;
END; $$;

-- ===== 9. Existing functions that deleted rows =====
CREATE OR REPLACE FUNCTION public.admin_unlink_tenant_unit(_tenant_account_id uuid, _unit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM set_config('app.archive_reason', 'فك ربط وحدة من حساب المستأجر', true);
  DELETE FROM public.tenant_account_units WHERE tenant_account_id = _tenant_account_id AND unit_id = _unit_id;
  PERFORM public._safety_audit('UNLINK', 'tenant_account_units', _tenant_account_id::text, jsonb_build_object('unit_id', _unit_id), NULL, 'فك ربط وحدة من حساب المستأجر');
END; $$;

CREATE OR REPLACE FUNCTION public.merge_duplicate_tenant_accounts()
RETURNS TABLE(merged_groups integer, deleted_accounts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'الدمج التلقائي معطّل؛ استخدم الدمج اليدوي القابل للتراجع' USING ERRCODE = '42501';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_auto_merge_duplicate_tenants()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'الدمج التلقائي معطّل؛ استخدم الدمج اليدوي القابل للتراجع' USING ERRCODE = '42501';
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_auto_merge_duplicate_tenants() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_tenant_accounts() FROM PUBLIC, anon, authenticated;

-- Reversible manual merge
CREATE OR REPLACE FUNCTION public.admin_merge_tenant_accounts(_canonical_id uuid, _duplicate_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dup uuid; _canonical public.tenant_accounts; _canon_before jsonb; _dup_row public.tenant_accounts; _c public.tenant_accounts;
  _moved_links uuid[]; _dropped_links jsonb; _inv uuid[]; _col uuid[]; _files uuid[]; _bk uuid[]; _logins uuid[];
  _filled text[]; _moved_user boolean; _merged int := 0;
BEGIN
  PERFORM public._assert_admin_writer();
  IF _canonical_id IS NULL OR _duplicate_ids IS NULL OR array_length(_duplicate_ids,1) IS NULL THEN RAISE EXCEPTION 'معطيات غير صالحة'; END IF;
  SELECT * INTO _canonical FROM public.tenant_accounts WHERE id = _canonical_id AND merged_into IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'السجل الرئيسي غير موجود أو مدمج مسبقاً'; END IF;
  _canon_before := to_jsonb(_canonical);

  FOREACH _dup IN ARRAY _duplicate_ids LOOP
    IF _dup = _canonical_id THEN CONTINUE; END IF;
    SELECT * INTO _dup_row FROM public.tenant_accounts WHERE id = _dup FOR UPDATE;
    IF NOT FOUND OR _dup_row.merged_into IS NOT NULL THEN CONTINUE; END IF;
    SELECT * INTO _c FROM public.tenant_accounts WHERE id = _canonical_id;

    SELECT array_agg(id) INTO _moved_links FROM public.tenant_account_units tau
      WHERE tau.tenant_account_id = _dup
        AND NOT EXISTS (SELECT 1 FROM public.tenant_account_units x WHERE x.tenant_account_id = _canonical_id AND x.unit_id = tau.unit_id);
    SELECT jsonb_agg(to_jsonb(tau)) INTO _dropped_links FROM public.tenant_account_units tau
      WHERE tau.tenant_account_id = _dup AND NOT (tau.id = ANY(COALESCE(_moved_links, ARRAY[]::uuid[])));
    SELECT array_agg(id) INTO _inv    FROM public.invoices WHERE tenant_account_id = _dup;
    SELECT array_agg(id) INTO _col    FROM public.unit_collections WHERE tenant_account_id = _dup;
    SELECT array_agg(id) INTO _files  FROM public.tenant_account_files WHERE tenant_account_id = _dup;
    SELECT array_agg(id) INTO _bk     FROM public.bookings WHERE previous_tenant_account_id = _dup;
    SELECT array_agg(id) INTO _logins FROM public.tenant_login_links WHERE tenant_account_id = _dup;

    UPDATE public.tenant_account_units SET tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_moved_links, ARRAY[]::uuid[]));
    PERFORM set_config('app.archive_reason', 'دمج حساب مكرر (رابط وحدة مكرر)', true);
    DELETE FROM public.tenant_account_units WHERE tenant_account_id = _dup;  -- preserved in archived_rows + snapshot
    UPDATE public.invoices SET tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_inv, ARRAY[]::uuid[]));
    UPDATE public.unit_collections SET tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_col, ARRAY[]::uuid[]));
    UPDATE public.tenant_account_files SET tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_files, ARRAY[]::uuid[]));
    UPDATE public.bookings SET previous_tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_bk, ARRAY[]::uuid[]));
    UPDATE public.tenant_login_links SET tenant_account_id = _canonical_id WHERE id = ANY(COALESCE(_logins, ARRAY[]::uuid[]));

    _filled := ARRAY[]::text[];
    IF NULLIF(btrim(coalesce(_c.phone,'')),'') IS NULL AND _dup_row.phone IS NOT NULL THEN _filled := _filled || 'phone'; END IF;
    IF NULLIF(btrim(coalesce(_c.email,'')),'') IS NULL AND _dup_row.email IS NOT NULL THEN _filled := _filled || 'email'; END IF;
    IF NULLIF(btrim(coalesce(_c.business_name,'')),'') IS NULL AND _dup_row.business_name IS NOT NULL THEN _filled := _filled || 'business_name'; END IF;
    IF NULLIF(btrim(coalesce(_c.cr_number,'')),'') IS NULL AND _dup_row.cr_number IS NOT NULL THEN _filled := _filled || 'cr_number'; END IF;
    IF NULLIF(btrim(coalesce(_c.activity_type,'')),'') IS NULL AND _dup_row.activity_type IS NOT NULL THEN _filled := _filled || 'activity_type'; END IF;
    IF NULLIF(btrim(coalesce(_c.notes,'')),'') IS NULL AND _dup_row.notes IS NOT NULL THEN _filled := _filled || 'notes'; END IF;
    _moved_user := (_c.user_id IS NULL AND _dup_row.user_id IS NOT NULL);
    IF _moved_user THEN UPDATE public.tenant_accounts SET user_id = NULL WHERE id = _dup; END IF;

    UPDATE public.tenant_accounts ca SET
        phone = CASE WHEN 'phone' = ANY(_filled) THEN _dup_row.phone ELSE ca.phone END,
        email = CASE WHEN 'email' = ANY(_filled) THEN _dup_row.email ELSE ca.email END,
        business_name = CASE WHEN 'business_name' = ANY(_filled) THEN _dup_row.business_name ELSE ca.business_name END,
        cr_number = CASE WHEN 'cr_number' = ANY(_filled) THEN _dup_row.cr_number ELSE ca.cr_number END,
        activity_type = CASE WHEN 'activity_type' = ANY(_filled) THEN _dup_row.activity_type ELSE ca.activity_type END,
        notes = CASE WHEN 'notes' = ANY(_filled) THEN _dup_row.notes ELSE ca.notes END,
        user_id = CASE WHEN _moved_user THEN _dup_row.user_id ELSE ca.user_id END,
        paid_amount = COALESCE(ca.paid_amount,0) + COALESCE(_dup_row.paid_amount,0),
        updated_at = now()
      WHERE ca.id = _canonical_id;

    UPDATE public.tenant_accounts SET
        merged_into = _canonical_id, merged_into_id = _canonical_id, merged_at = now(), merged_by = auth.uid(),
        unmerged_at = NULL, unmerged_by = NULL,
        merge_snapshot = jsonb_build_object(
          'canonical_id', _canonical_id, 'dup_before', to_jsonb(_dup_row), 'canonical_before', to_jsonb(_c),
          'moved_link_ids', to_jsonb(COALESCE(_moved_links, ARRAY[]::uuid[])), 'dropped_links', COALESCE(_dropped_links, '[]'::jsonb),
          'invoice_ids', to_jsonb(COALESCE(_inv, ARRAY[]::uuid[])), 'collection_ids', to_jsonb(COALESCE(_col, ARRAY[]::uuid[])),
          'file_ids', to_jsonb(COALESCE(_files, ARRAY[]::uuid[])), 'booking_ids', to_jsonb(COALESCE(_bk, ARRAY[]::uuid[])),
          'login_ids', to_jsonb(COALESCE(_logins, ARRAY[]::uuid[])), 'filled_fields', to_jsonb(_filled), 'moved_user', _moved_user),
        updated_at = now()
      WHERE id = _dup;
    _merged := _merged + 1;
  END LOOP;

  PERFORM public.recalc_tenant_account_total(_canonical_id);
  PERFORM public._safety_audit('MERGE', 'tenant_accounts', _canonical_id::text, _canon_before,
    (SELECT to_jsonb(t) FROM public.tenant_accounts t WHERE id = _canonical_id), 'دمج يدوي');
  RETURN jsonb_build_object('ok', true, 'canonical_id', _canonical_id, 'merged', _merged);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unmerge_tenant_account(_merged_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r text; _d public.tenant_accounts; _s jsonb; _canon uuid; _before jsonb; _f text; _link jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  _r := public._assert_reason(_reason);
  SELECT * INTO _d FROM public.tenant_accounts WHERE id = _merged_id FOR UPDATE;
  IF NOT FOUND OR _d.merged_into IS NULL THEN RAISE EXCEPTION 'الحساب غير مدمج'; END IF;
  _s := _d.merge_snapshot;
  IF _s IS NULL THEN RAISE EXCEPTION 'هذا الدمج قديم بدون لقطة تراجع؛ لا يمكن التراجع آلياً'; END IF;
  _canon := (_s->>'canonical_id')::uuid;
  SELECT to_jsonb(t) INTO _before FROM public.tenant_accounts t WHERE id = _canon;

  UPDATE public.tenant_account_units SET tenant_account_id = _merged_id
    WHERE id IN (SELECT jsonb_array_elements_text(_s->'moved_link_ids')::uuid) AND tenant_account_id = _canon;
  FOR _link IN SELECT * FROM jsonb_array_elements(_s->'dropped_links') LOOP
    INSERT INTO public.tenant_account_units(id, tenant_account_id, unit_id, tenant_id, created_at)
    VALUES ((_link->>'id')::uuid, _merged_id, (_link->>'unit_id')::uuid, NULLIF(_link->>'tenant_id','')::uuid, (_link->>'created_at')::timestamptz)
    ON CONFLICT DO NOTHING;
  END LOOP;
  UPDATE public.invoices SET tenant_account_id = _merged_id WHERE id IN (SELECT jsonb_array_elements_text(_s->'invoice_ids')::uuid) AND tenant_account_id = _canon;
  UPDATE public.unit_collections SET tenant_account_id = _merged_id WHERE id IN (SELECT jsonb_array_elements_text(_s->'collection_ids')::uuid) AND tenant_account_id = _canon;
  UPDATE public.tenant_account_files SET tenant_account_id = _merged_id WHERE id IN (SELECT jsonb_array_elements_text(_s->'file_ids')::uuid) AND tenant_account_id = _canon;
  UPDATE public.bookings SET previous_tenant_account_id = _merged_id WHERE id IN (SELECT jsonb_array_elements_text(_s->'booking_ids')::uuid) AND previous_tenant_account_id = _canon;
  UPDATE public.tenant_login_links SET tenant_account_id = _merged_id WHERE id IN (SELECT jsonb_array_elements_text(_s->'login_ids')::uuid) AND tenant_account_id = _canon;

  FOR _f IN SELECT jsonb_array_elements_text(_s->'filled_fields') LOOP
    EXECUTE format('UPDATE public.tenant_accounts SET %I = $1 WHERE id = $2 AND %I IS NOT DISTINCT FROM $3', _f, _f)
      USING (_s->'canonical_before'->>_f), _canon, (_s->'dup_before'->>_f);
  END LOOP;
  IF (_s->>'moved_user')::boolean THEN
    UPDATE public.tenant_accounts SET user_id = NULL WHERE id = _canon AND user_id = (_s->'dup_before'->>'user_id')::uuid;
    UPDATE public.tenant_accounts SET user_id = (_s->'dup_before'->>'user_id')::uuid WHERE id = _merged_id;
  END IF;
  UPDATE public.tenant_accounts SET paid_amount = GREATEST(COALESCE(paid_amount,0) - COALESCE((_s->'dup_before'->>'paid_amount')::numeric,0), 0), updated_at = now()
    WHERE id = _canon;
  UPDATE public.tenant_accounts SET merged_into = NULL, merged_into_id = NULL, unmerged_at = now(), unmerged_by = auth.uid(),
    paid_amount = COALESCE((_s->'dup_before'->>'paid_amount')::numeric, paid_amount), updated_at = now()
    WHERE id = _merged_id;

  PERFORM public.recalc_tenant_account_total(_canon);
  PERFORM public.recalc_tenant_account_total(_merged_id);
  PERFORM public._safety_audit('UNMERGE', 'tenant_accounts', _merged_id::text, _before,
    (SELECT to_jsonb(t) FROM public.tenant_accounts t WHERE id = _canon), _r);
  RETURN jsonb_build_object('ok', true, 'restored_id', _merged_id, 'canonical_id', _canon);
END; $$;

-- Lists: active excludes archived; separate lists for archived and merged
CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
 RETURNS TABLE(id uuid, user_id uuid, full_name text, phone text, email text, business_name text, activity_type text, notes text, total_price numeric, paid_amount numeric, created_at timestamp with time zone, units_count bigint, unpaid_invoices bigint, unpaid_total numeric, has_login boolean, cr_number text, files_count bigint, collected_total numeric)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name, ta.activity_type, ta.notes, ta.total_price, ta.paid_amount, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units u WHERE u.tenant_account_id = ta.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    (ta.user_id IS NOT NULL), ta.cr_number,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_files f WHERE f.tenant_account_id = ta.id AND f.is_archived = false), 0),
    COALESCE((SELECT SUM(c.amount) FROM public.unit_collections c WHERE c.tenant_account_id = ta.id AND c.is_archived = false), 0)
  FROM public.tenant_accounts ta
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND ta.merged_into IS NULL AND ta.archived_at IS NULL
  ORDER BY ta.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_inactive_tenant_accounts()
RETURNS TABLE(id uuid, full_name text, business_name text, phone text, kind text, reason text, at timestamptz, merged_into_id uuid, merged_into_name text, can_unmerge boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ta.id, ta.full_name, ta.business_name, ta.phone,
    CASE WHEN ta.merged_into IS NOT NULL THEN 'merged' ELSE 'archived' END,
    ta.archive_reason, COALESCE(ta.merged_at, ta.archived_at), ta.merged_into,
    (SELECT c.full_name FROM public.tenant_accounts c WHERE c.id = ta.merged_into),
    (ta.merged_into IS NOT NULL AND ta.merge_snapshot IS NOT NULL)
  FROM public.tenant_accounts ta
  WHERE (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
    AND (ta.merged_into IS NOT NULL OR ta.archived_at IS NOT NULL)
  ORDER BY COALESCE(ta.merged_at, ta.archived_at) DESC;
$$;

-- ===== 10. Control role: maintenance only =====
CREATE OR REPLACE FUNCTION public.units_control_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'maintenance' AND OLD.status IS DISTINCT FROM 'maintenance' THEN
    NEW.status_before_maintenance := OLD.status;
  END IF;
  IF auth.role() = 'service_role' OR auth.uid() IS NULL OR public.has_role(auth.uid(),'admin')
     OR NOT public.has_role(auth.uid(),'control') THEN
    IF OLD.status = 'maintenance' AND NEW.status <> 'maintenance' THEN NEW.status_before_maintenance := NULL; END IF;
    RETURN NEW;
  END IF;
  -- control user (not admin)
  IF (to_jsonb(NEW) - ARRAY['status','updated_at','status_before_maintenance']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','updated_at','status_before_maintenance']) THEN
    RAISE EXCEPTION 'صلاحية التحكم: تغيير حالة الصيانة فقط' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'maintenance' THEN
      RETURN NEW;
    ELSIF OLD.status = 'maintenance' AND OLD.status_before_maintenance IS NOT NULL AND NEW.status = OLD.status_before_maintenance THEN
      NEW.status_before_maintenance := NULL;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'صلاحية التحكم: يمكن وضع الوحدة في الصيانة أو إخراجها منها لحالتها السابقة فقط' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS units_control_guard ON public.units;
CREATE TRIGGER units_control_guard BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.units_control_guard();

CREATE OR REPLACE FUNCTION public.control_set_maintenance(_unit_id uuid, _on boolean)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _u public.units;
BEGIN
  SELECT * INTO _u FROM public.units WHERE id = _unit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
  IF _on THEN
    UPDATE public.units SET status = 'maintenance', updated_at = now() WHERE id = _unit_id;
    RETURN 'maintenance';
  END IF;
  IF _u.status <> 'maintenance' THEN RETURN _u.status; END IF;
  IF _u.status_before_maintenance IS NULL THEN RAISE EXCEPTION 'الحالة السابقة غير معروفة؛ يحددها الأدمن'; END IF;
  UPDATE public.units SET status = _u.status_before_maintenance, updated_at = now() WHERE id = _unit_id;
  RETURN _u.status_before_maintenance;
END; $$;

-- Grants for new callable functions
REVOKE EXECUTE ON FUNCTION public._assert_admin_writer() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._safety_audit(text,text,text,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_record(text,uuid,text), public.unarchive_record(text,uuid,text),
  public.archive_tenant(uuid,text), public.archive_tenant_account(uuid,text),
  public.cancel_booking_with_reason(uuid,text), public.remove_booking_units(uuid,uuid[],text),
  public.reverse_payment(uuid,text), public.reverse_collection(uuid,text),
  public.admin_unmerge_tenant_account(uuid,text), public.admin_list_inactive_tenant_accounts(),
  public.control_set_maintenance(uuid,boolean) TO authenticated, service_role;
