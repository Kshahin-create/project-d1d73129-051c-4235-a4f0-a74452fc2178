
DROP FUNCTION IF EXISTS public.confirm_booking(uuid, numeric);

CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid, _paid_amount numeric DEFAULT 0)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _b RECORD; _u RECORD; _ta_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  UPDATE public.bookings SET status = 'confirmed', paid_amount = COALESCE(_paid_amount, 0), updated_at = now() WHERE id = _booking_id;
  FOR _u IN SELECT bu.unit_id, bu.activity, bu.building_number, bu.unit_number FROM public.booking_units bu WHERE bu.booking_id = _booking_id LOOP
    UPDATE public.units SET status = 'rented', updated_at = now() WHERE id = _u.unit_id;
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE unit_id = _u.unit_id AND booking_id = _booking_id) THEN
      INSERT INTO public.tenants (unit_id, tenant_name, business_name, activity_type, phone, notes, start_date, booking_id, offer_image_url, cr_number)
      VALUES (_u.unit_id, _b.customer_full_name, _b.business_name, _u.activity, _b.customer_phone, _b.notes, CURRENT_DATE, _booking_id, _b.offer_image_url, _b.cr_number);
    END IF;
  END LOOP;
  SELECT id INTO _ta_id FROM public.tenant_accounts
    WHERE btrim(full_name) = btrim(_b.customer_full_name)
      AND COALESCE(NULLIF(btrim(COALESCE(phone,'')), ''), '') = COALESCE(NULLIF(btrim(COALESCE(_b.customer_phone,'')), ''), '')
    LIMIT 1;
  IF _ta_id IS NOT NULL AND COALESCE(_paid_amount, 0) > 0 THEN
    UPDATE public.tenant_accounts SET paid_amount = COALESCE(paid_amount,0) + COALESCE(_paid_amount,0), updated_at = now() WHERE id = _ta_id;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _b RECORD; _u RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  UPDATE public.bookings SET status = 'confirmed', updated_at = now() WHERE id = _booking_id;
  FOR _u IN SELECT bu.unit_id, bu.activity, bu.building_number, bu.unit_number FROM public.booking_units bu WHERE bu.booking_id = _booking_id LOOP
    UPDATE public.units SET status = 'rented', updated_at = now() WHERE id = _u.unit_id;
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE unit_id = _u.unit_id AND booking_id = _booking_id) THEN
      INSERT INTO public.tenants (unit_id, tenant_name, business_name, activity_type, phone, notes, start_date, booking_id, offer_image_url, cr_number)
      VALUES (_u.unit_id, _b.customer_full_name, _b.business_name, _u.activity, _b.customer_phone, _b.notes, CURRENT_DATE, _booking_id, _b.offer_image_url, _b.cr_number);
    END IF;
  END LOOP;
END; $function$;

CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = _booking_id;
  UPDATE public.units u SET status = 'available', updated_at = now()
   WHERE u.id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id)
     AND u.status = 'reserved'
     AND NOT EXISTS (
       SELECT 1 FROM public.booking_units bu2
       JOIN public.bookings b2 ON b2.id = bu2.booking_id
       WHERE bu2.unit_id = u.id AND b2.id <> _booking_id AND b2.status IN ('pending','confirmed')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.tenants t
       WHERE t.unit_id = u.id AND (t.booking_id IS NULL OR t.booking_id <> _booking_id)
     );
END; $function$;

CREATE OR REPLACE FUNCTION public.set_booking_paid_amount(_booking_id uuid, _paid_amount numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _paid_amount IS NULL OR _paid_amount < 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  UPDATE public.bookings SET paid_amount = _paid_amount, updated_at = now() WHERE id = _booking_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_tenant_account_paid_amount(_tenant_account_id uuid, _paid_amount numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _paid_amount IS NULL OR _paid_amount < 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  UPDATE public.tenant_accounts SET paid_amount = _paid_amount, updated_at = now() WHERE id = _tenant_account_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.extend_booking_expiry(_booking_id uuid, _hours integer)
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _new_expiry timestamptz; _current_status text; _current_expiry timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _hours IS NULL OR _hours = 0 THEN RAISE EXCEPTION 'عدد الساعات غير صالح'; END IF;
  SELECT status, expires_at INTO _current_status, _current_expiry FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF _current_expiry < now() THEN _new_expiry := now() + make_interval(hours => _hours);
  ELSE _new_expiry := _current_expiry + make_interval(hours => _hours); END IF;
  UPDATE public.bookings SET expires_at = _new_expiry,
    status = CASE WHEN status = 'expired' THEN 'pending' ELSE status END, updated_at = now()
    WHERE id = _booking_id;
  IF _current_status = 'expired' THEN
    UPDATE public.units SET status = 'reserved', updated_at = now()
    WHERE id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id) AND status = 'available';
  END IF;
  RETURN _new_expiry;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_link_tenant_units(_tenant_account_id uuid, _unit_ids uuid[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN RETURN; END IF;
  INSERT INTO public.tenant_account_units (tenant_account_id, unit_id)
  SELECT _tenant_account_id, u FROM unnest(_unit_ids) AS u
  ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_unlink_tenant_unit(_tenant_account_id uuid, _unit_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.tenant_account_units WHERE tenant_account_id = _tenant_account_id AND unit_id = _unit_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.record_payment(_booking_id uuid DEFAULT NULL::uuid, _tenant_account_id uuid DEFAULT NULL::uuid, _amount numeric DEFAULT 0, _method text DEFAULT 'cash'::text, _notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _invoice_id uuid; _b RECORD; _ta RECORD; _ta_id uuid := _tenant_account_id;
  _name text; _phone text; _bus text; _cr text; _unit_id uuid; _inv_num text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  IF _booking_id IS NULL AND _tenant_account_id IS NULL THEN RAISE EXCEPTION 'يجب تحديد حجز أو حساب مستأجر'; END IF;
  IF _booking_id IS NOT NULL THEN
    SELECT * INTO _b FROM public.bookings WHERE id = _booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
    UPDATE public.bookings SET paid_amount = COALESCE(paid_amount,0) + _amount, updated_at = now() WHERE id = _booking_id;
    _name := _b.customer_full_name; _phone := _b.customer_phone; _bus := _b.business_name; _cr := _b.cr_number;
    SELECT unit_id INTO _unit_id FROM public.booking_units WHERE booking_id = _booking_id LIMIT 1;
    IF _ta_id IS NULL THEN
      SELECT id INTO _ta_id FROM public.tenant_accounts
        WHERE btrim(full_name) = btrim(_b.customer_full_name)
          AND COALESCE(NULLIF(btrim(COALESCE(phone,'')), ''), '') = COALESCE(NULLIF(btrim(COALESCE(_b.customer_phone,'')), ''), '')
        LIMIT 1;
    END IF;
  END IF;
  IF _ta_id IS NOT NULL THEN
    SELECT * INTO _ta FROM public.tenant_accounts WHERE id = _ta_id;
    IF FOUND THEN
      UPDATE public.tenant_accounts SET paid_amount = COALESCE(paid_amount,0) + _amount, updated_at = now() WHERE id = _ta_id;
      IF _name IS NULL THEN _name := _ta.full_name; END IF;
      IF _phone IS NULL THEN _phone := _ta.phone; END IF;
      IF _bus IS NULL THEN _bus := _ta.business_name; END IF;
      IF _cr IS NULL THEN _cr := _ta.cr_number; END IF;
    END IF;
  END IF;
  _inv_num := public.next_invoice_number();
  INSERT INTO public.invoices (
    tenant_account_id, booking_id, unit_id, amount, paid_amount, paid, paid_at,
    notes, created_by, invoice_number, payment_method,
    customer_name, customer_phone, customer_business, cr_number
  ) VALUES (
    _ta_id, _booking_id, _unit_id, _amount, _amount, true, now(),
    _notes, auth.uid(), _inv_num, COALESCE(_method,'cash'),
    _name, _phone, _bus, _cr
  ) RETURNING id INTO _invoice_id;
  RETURN _invoice_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.consolidate_existing_tenants()
 RETURNS TABLE(created_accounts integer, linked_units integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _grp RECORD; _acc_id UUID; _existing UUID; _linked INT := 0; _created INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR _grp IN
    SELECT btrim(t.tenant_name) AS name,
      NULLIF(btrim(COALESCE(t.phone, '')), '') AS phone,
      MAX(t.business_name) FILTER (WHERE t.business_name IS NOT NULL AND btrim(t.business_name) <> '') AS business_name,
      MAX(t.activity_type) FILTER (WHERE t.activity_type IS NOT NULL AND btrim(t.activity_type) <> '') AS activity_type,
      MAX(t.notes) FILTER (WHERE t.notes IS NOT NULL AND btrim(t.notes) <> '') AS notes,
      array_agg(DISTINCT t.unit_id) FILTER (WHERE t.unit_id IS NOT NULL) AS unit_ids
    FROM public.tenants t
    WHERE t.tenant_name IS NOT NULL AND btrim(t.tenant_name) <> ''
    GROUP BY btrim(t.tenant_name), NULLIF(btrim(COALESCE(t.phone, '')), '')
  LOOP
    SELECT id INTO _existing FROM public.tenant_accounts
    WHERE btrim(full_name) = _grp.name
      AND COALESCE(NULLIF(btrim(COALESCE(phone, '')), ''), '') = COALESCE(_grp.phone, '')
    LIMIT 1;
    IF _existing IS NULL THEN
      INSERT INTO public.tenant_accounts (full_name, phone, business_name, activity_type, notes, created_by)
      VALUES (_grp.name, _grp.phone, _grp.business_name, _grp.activity_type, _grp.notes, auth.uid())
      RETURNING id INTO _acc_id;
      _created := _created + 1;
    ELSE
      _acc_id := _existing;
      UPDATE public.tenant_accounts SET business_name = COALESCE(business_name, _grp.business_name),
          activity_type = COALESCE(activity_type, _grp.activity_type), notes = COALESCE(notes, _grp.notes)
      WHERE id = _acc_id;
    END IF;
    IF _grp.unit_ids IS NOT NULL THEN
      INSERT INTO public.tenant_account_units (tenant_account_id, unit_id)
      SELECT _acc_id, u FROM unnest(_grp.unit_ids) AS u
      ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
      _linked := _linked + array_length(_grp.unit_ids, 1);
    END IF;
    PERFORM public.recalc_tenant_account_total(_acc_id);
  END LOOP;
  created_accounts := _created;
  linked_units := _linked;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.sync_all_rented_units_to_accounts()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _t RECORD; _acc_id uuid; _n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR _t IN
    SELECT t.id, t.unit_id FROM public.tenants t
    JOIN public.units u ON u.id = t.unit_id
    WHERE u.status = 'rented'
      AND NOT EXISTS (SELECT 1 FROM public.tenant_account_units tau WHERE tau.unit_id = t.unit_id)
  LOOP
    _acc_id := public.ensure_tenant_account_for_tenant(_t.id);
    IF _acc_id IS NOT NULL THEN
      INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
      VALUES (_acc_id, _t.unit_id, _t.id)
      ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
      PERFORM public.recalc_tenant_account_total(_acc_id);
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END; $function$;

CREATE OR REPLACE FUNCTION public.import_leads(_rows jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _r jsonb; _n int := 0; _name text; _phone text; _notes text;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR _r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _name := btrim(COALESCE(_r->>'full_name',''));
    _phone := btrim(COALESCE(_r->>'phone',''));
    _notes := NULLIF(btrim(COALESCE(_r->>'notes','')),'');
    IF _name = '' OR _phone = '' THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.leads WHERE phone = _phone) THEN CONTINUE; END IF;
    INSERT INTO public.leads (full_name, phone, notes, created_by) VALUES (_name, _phone, _notes, auth.uid());
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $function$;

CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
DECLARE _t text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  _t := encode(extensions.gen_random_bytes(12), 'hex');
  INSERT INTO public.telegram_link_tokens (token, user_id) VALUES (_t, auth.uid());
  RETURN _t;
END; $function$;

CREATE OR REPLACE FUNCTION public.merge_duplicate_tenant_accounts()
 RETURNS TABLE(merged_groups integer, deleted_accounts integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _grp RECORD; _canonical uuid; _dup uuid; _ids uuid[]; _groups int := 0; _deleted int := 0; _i int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR _grp IN
    SELECT btrim(full_name) AS name,
      array_agg(id ORDER BY (user_id IS NOT NULL) DESC, (phone IS NOT NULL) DESC,
                            (cr_number IS NOT NULL) DESC, created_at) AS ids
    FROM public.tenant_accounts
    WHERE full_name IS NOT NULL AND btrim(full_name) <> ''
    GROUP BY btrim(full_name) HAVING count(*) > 1
  LOOP
    _ids := _grp.ids; _canonical := _ids[1]; _groups := _groups + 1;
    FOR _i IN 2..array_length(_ids, 1) LOOP
      _dup := _ids[_i];
      UPDATE public.tenant_account_units tau SET tenant_account_id = _canonical
        WHERE tau.tenant_account_id = _dup
          AND NOT EXISTS (SELECT 1 FROM public.tenant_account_units x
            WHERE x.tenant_account_id = _canonical AND x.unit_id = tau.unit_id);
      DELETE FROM public.tenant_account_units WHERE tenant_account_id = _dup;
      UPDATE public.invoices SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;
      UPDATE public.tenant_login_links SET tenant_account_id = _canonical WHERE tenant_account_id = _dup;
      UPDATE public.tenant_accounts ca
        SET paid_amount = COALESCE(ca.paid_amount,0) + COALESCE(d.paid_amount,0),
            phone = COALESCE(ca.phone, d.phone), email = COALESCE(ca.email, d.email),
            business_name = COALESCE(ca.business_name, d.business_name),
            cr_number = COALESCE(ca.cr_number, d.cr_number),
            activity_type = COALESCE(ca.activity_type, d.activity_type),
            user_id = COALESCE(ca.user_id, d.user_id),
            notes = COALESCE(NULLIF(ca.notes,''), NULLIF(d.notes,'')),
            updated_at = now()
        FROM public.tenant_accounts d WHERE ca.id = _canonical AND d.id = _dup;
      DELETE FROM public.tenant_accounts WHERE id = _dup;
      _deleted := _deleted + 1;
    END LOOP;
    PERFORM public.recalc_tenant_account_total(_canonical);
  END LOOP;
  merged_groups := _groups; deleted_accounts := _deleted; RETURN NEXT;
END; $function$;

-- ============================================================
-- RLS policies: manager becomes SELECT-only on write-tables
-- ============================================================

DROP POLICY IF EXISTS "Managers update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Managers manage tenants" ON public.tenants;
DROP POLICY IF EXISTS "Managers update units" ON public.units;

DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage interested" ON public.interested_customers;
CREATE POLICY "Admins manage interested" ON public.interested_customers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers view interested" ON public.interested_customers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
CREATE POLICY "Admins manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers view leads" ON public.leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Admins manage tenant files" ON public.tenant_account_files;
CREATE POLICY "Admins manage tenant files" ON public.tenant_account_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers view tenant files" ON public.tenant_account_files
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "Admins manage unit links" ON public.tenant_account_units;
CREATE POLICY "Admins manage unit links" ON public.tenant_account_units
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage tenant accounts" ON public.tenant_accounts;
CREATE POLICY "Admins manage tenant accounts" ON public.tenant_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin_manager_delete_unit_files" ON public.unit_files;
DROP POLICY IF EXISTS "admin_manager_insert_unit_files" ON public.unit_files;
DROP POLICY IF EXISTS "admin_manager_update_unit_files" ON public.unit_files;
CREATE POLICY "admin_delete_unit_files" ON public.unit_files
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_insert_unit_files" ON public.unit_files
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admin_update_unit_files" ON public.unit_files
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can insert unit audit" ON public.unit_audit_log;
