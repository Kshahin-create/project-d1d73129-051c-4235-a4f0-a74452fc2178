-- Stage 1 — unified customers (parties): computed status, single upsert with phone-key dedupe,
-- auto-link of interested/leads, audited edit/close/duplicate/merge/unmerge, optional owner,
-- shared team tasks, sticky do-not-contact and import batches. Additive and idempotent.

-- 1) Columns -----------------------------------------------------------------
ALTER TABLE public.parties
  ADD COLUMN IF NOT EXISTS phone_key text GENERATED ALWAYS AS (
    CASE WHEN length(regexp_replace(coalesce(phone,''),'\D','','g')) >= 9
         THEN right(regexp_replace(phone,'\D','','g'), 9) END) STORED,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS interested_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_by uuid,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_of_id uuid REFERENCES public.parties(id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parties_close_reason_check') THEN
    ALTER TABLE public.parties ADD CONSTRAINT parties_close_reason_check
      CHECK (close_reason IS NULL OR close_reason IN ('not_interested','no_answer','not_suitable','chose_other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS parties_phone_key_idx ON public.parties(phone_key);
CREATE INDEX IF NOT EXISTS parties_id_number_idx ON public.parties(id_number);
CREATE INDEX IF NOT EXISTS parties_owner_idx ON public.parties(owner_user_id);
CREATE INDEX IF NOT EXISTS opportunities_party_idx ON public.opportunities(party_id);
CREATE INDEX IF NOT EXISTS bookings_party_idx ON public.bookings(party_id);
CREATE INDEX IF NOT EXISTS tenants_party_idx ON public.tenants(party_id);
CREATE INDEX IF NOT EXISTS contracts_party_idx ON public.contracts(party_id);
CREATE INDEX IF NOT EXISTS interested_party_idx ON public.interested_customers(party_id);
CREATE INDEX IF NOT EXISTS leads_party_idx ON public.leads(party_id);
CREATE INDEX IF NOT EXISTS party_activities_party_idx ON public.party_activities(party_id);

-- Tasks may be shared with the whole sales team when the customer has no owner.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_visibility_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_visibility_check
  CHECK (visibility = ANY (ARRAY['operational','financial','escalation','team']));

-- 2) Merge ledger and import batches ------------------------------------------
CREATE TABLE IF NOT EXISTS public.party_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_party_id uuid NOT NULL REFERENCES public.parties(id),
  into_party_id uuid NOT NULL REFERENCES public.parties(id),
  moved jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  merged_by uuid,
  merged_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz,
  undone_by uuid,
  undo_reason text
);
GRANT SELECT ON public.party_merges TO authenticated;
GRANT ALL ON public.party_merges TO service_role;
ALTER TABLE public.party_merges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS party_merges_read ON public.party_merges;
CREATE POLICY party_merges_read ON public.party_merges FOR SELECT TO authenticated
  USING (public.has_permission('customers.names','view'));

CREATE TABLE IF NOT EXISTS public.party_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','applied','cancelled')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid,
  applied_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.party_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.party_import_batches(id),
  row_no integer NOT NULL,
  full_name text,
  phone text,
  phone_key text,
  id_type text,
  id_number text,
  city text,
  notes text,
  action text NOT NULL CHECK (action IN ('new','existing','invalid','duplicate_in_file')),
  reason text,
  party_id uuid REFERENCES public.parties(id),
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS party_import_rows_batch_idx ON public.party_import_rows(batch_id, row_no);
GRANT SELECT ON public.party_import_batches, public.party_import_rows TO authenticated;
GRANT ALL ON public.party_import_batches, public.party_import_rows TO service_role;
ALTER TABLE public.party_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS party_import_batches_read ON public.party_import_batches;
CREATE POLICY party_import_batches_read ON public.party_import_batches FOR SELECT TO authenticated
  USING (public.has_permission('opportunities.write','edit') OR public.has_permission('opportunities.write','own'));
DROP POLICY IF EXISTS party_import_rows_read ON public.party_import_rows;
CREATE POLICY party_import_rows_read ON public.party_import_rows FOR SELECT TO authenticated
  USING (public.has_permission('opportunities.write','edit') OR public.has_permission('opportunities.write','own'));
DROP TRIGGER IF EXISTS party_import_batches_no_delete ON public.party_import_batches;
CREATE TRIGGER party_import_batches_no_delete BEFORE DELETE ON public.party_import_batches FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();
DROP TRIGGER IF EXISTS party_merges_no_delete ON public.party_merges;
CREATE TRIGGER party_merges_no_delete BEFORE DELETE ON public.party_merges FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

-- 3) Core helpers --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.party_phone_key(_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN length(regexp_replace(coalesce(_phone,''),'\D','','g')) >= 9
              THEN right(regexp_replace(_phone,'\D','','g'), 9) END
$$;

CREATE OR REPLACE FUNCTION public.party_can_write()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_permission('opportunities.write','edit') OR public.has_permission('opportunities.write','own'))
$$;

CREATE OR REPLACE FUNCTION public._party_find(_phone_key text, _id_number text)
RETURNS public.parties LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.parties p
  WHERE p.archived_at IS NULL AND p.merged_into_id IS NULL AND p.duplicate_of_id IS NULL
    AND ((_id_number IS NOT NULL AND p.id_number = _id_number) OR (_phone_key IS NOT NULL AND p.phone_key = _phone_key))
  ORDER BY (_id_number IS NOT NULL AND p.id_number = _id_number) DESC, p.created_at, p.id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._party_insert(_name text, _phone text, _email text, _id_type text, _id_number text,
  _party_type public.party_type, _city text, _source text, _owner uuid, _interested boolean)
RETURNS public.parties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _seq bigint; _p public.parties; _k text := public.party_phone_key(_phone);
BEGIN
  UPDATE public.party_code_counter SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO _seq;
  INSERT INTO public.parties (tenant_code, party_type, name_ar, id_type, id_number, phone, email, city, source, created_by, owner_user_id, interested_at)
  VALUES ('T-' || lpad(_seq::text, 6, '0'),
          coalesce(_party_type, CASE WHEN _id_type = 'commercial_registration' THEN 'company'::public.party_type ELSE 'individual'::public.party_type END),
          coalesce(nullif(btrim(_name),''), 'بدون اسم'), _id_type, nullif(btrim(coalesce(_id_number,'')),''),
          CASE WHEN _k ~ '^5[0-9]{8}$' THEN '+966' || _k ELSE nullif(btrim(coalesce(_phone,'')),'') END,
          nullif(btrim(coalesce(_email,'')),''), nullif(btrim(coalesce(_city,'')),''), _source, auth.uid(), _owner,
          CASE WHEN _interested THEN now() END)
  RETURNING * INTO _p;
  PERFORM public._safety_audit('PARTY_CREATE','parties',_p.id::text,NULL,to_jsonb(_p),coalesce(_source,'إضافة عميل'));
  RETURN _p;
END $$;

-- Computed customer status (never stored, never typed by hand).
CREATE OR REPLACE FUNCTION public.party_status(_p public.parties)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _p.archived_at IS NOT NULL OR _p.merged_into_id IS NOT NULL OR _p.duplicate_of_id IS NOT NULL THEN 'archived'
    WHEN EXISTS (SELECT 1 FROM public.contracts c WHERE c.party_id = _p.id AND c.status = 'active')
      OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.party_id = _p.id AND t.archived_at IS NULL AND (t.end_date IS NULL OR t.end_date >= current_date)) THEN 'tenant'
    WHEN EXISTS (SELECT 1 FROM public.bookings b WHERE b.party_id = _p.id AND b.archived_at IS NULL AND b.status IN ('pending','confirmed')) THEN 'booker'
    WHEN _p.closed_at IS NOT NULL THEN 'closed'
    WHEN _p.interested_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = _p.id AND o.outcome IS NULL AND o.stage NOT IN ('new','won'))
      OR EXISTS (SELECT 1 FROM public.interested_customers i WHERE i.party_id = _p.id AND i.archived_at IS NULL) THEN 'interested'
    ELSE 'target' END
$$;

CREATE OR REPLACE FUNCTION public.can_read_party_contact(_party uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission('customers.contacts','view')
    OR (public.has_permission('customers.contacts','own') AND (
          EXISTS (SELECT 1 FROM public.opportunities WHERE party_id = _party AND owner_user_id = auth.uid() AND outcome IS NULL)
       OR EXISTS (SELECT 1 FROM public.parties WHERE id = _party AND owner_user_id = auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public._party_json(_p public.parties)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', _p.id, 'tenant_code', _p.tenant_code, 'name_ar', _p.name_ar, 'name_en', _p.name_en,
    'party_type', _p.party_type, 'city', _p.city, 'source', _p.source, 'tenant_lifecycle', _p.tenant_lifecycle,
    'contact_visible', x.c,
    'phone', CASE WHEN x.c THEN _p.phone END, 'email', CASE WHEN x.c THEN _p.email END,
    'id_type', CASE WHEN x.c THEN _p.id_type END, 'id_number', CASE WHEN x.c THEN _p.id_number END,
    'status', public.party_status(_p),
    'owner_user_id', _p.owner_user_id,
    'owner_name', (SELECT display_name FROM public.profiles WHERE user_id = _p.owner_user_id LIMIT 1),
    'do_not_contact', _p.do_not_contact, 'do_not_contact_reason', _p.do_not_contact_reason, 'do_not_contact_at', _p.do_not_contact_at,
    'closed_at', _p.closed_at, 'close_reason', _p.close_reason, 'interested_at', _p.interested_at,
    'duplicate_of_id', _p.duplicate_of_id, 'merged_into_id', _p.merged_into_id,
    'duplicate_of_code', (SELECT tenant_code FROM public.parties WHERE id = coalesce(_p.merged_into_id, _p.duplicate_of_id)),
    'archived_at', _p.archived_at, 'archive_reason', _p.archive_reason,
    'created_at', _p.created_at, 'updated_at', _p.updated_at,
    'last_contact_at', greatest(
        (SELECT max(created_at) FROM public.party_activities WHERE party_id = _p.id),
        (SELECT max(a.created_at) FROM public.opportunity_activities a JOIN public.opportunities o ON o.id = a.opportunity_id WHERE o.party_id = _p.id)),
    'open_opportunity', (SELECT jsonb_build_object('id', o.id, 'stage', o.stage, 'next_action', o.next_action,
                                 'next_action_at', o.next_action_at, 'no_answer_attempts', o.no_answer_attempts, 'owner_user_id', o.owner_user_id)
                         FROM public.opportunities o WHERE o.party_id = _p.id AND o.outcome IS NULL AND o.stage <> 'won'
                         ORDER BY o.created_at DESC LIMIT 1))
  FROM (SELECT public.can_read_party_contact(_p.id) AS c) x
$$;

-- 4) Readers -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.party_get(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.parties;
BEGIN
  IF NOT public.has_permission('customers.names','view') THEN RAISE EXCEPTION 'غير مسموح بعرض العملاء'; END IF;
  SELECT * INTO _p FROM public.parties WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  RETURN public._party_json(_p);
END $$;

CREATE OR REPLACE FUNCTION public.party_directory_page(_status text DEFAULT 'all', _search text DEFAULT '',
  _owner uuid DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s text := btrim(coalesce(_search,'')); _d text; _res jsonb;
BEGIN
  IF NOT public.has_permission('customers.names','view') THEN RAISE EXCEPTION 'غير مسموح بعرض العملاء'; END IF;
  IF _status NOT IN ('all','tenant','booker','interested','target','closed','archived','no_owner') THEN RAISE EXCEPTION 'تصنيف غير صالح'; END IF;
  _d := regexp_replace(_s,'\D','','g');
  WITH base AS (
    SELECT p.id, p.created_at, public.party_status(p) AS st, p.owner_user_id
    FROM public.parties p
    WHERE (_s = '' OR p.name_ar ILIKE '%' || _s || '%' OR p.tenant_code ILIKE '%' || _s || '%'
           OR (length(_d) >= 4 AND public.can_read_party_contact(p.id)
               AND (p.phone_key LIKE '%' || right(_d, 9) || '%' OR p.id_number = _s)))
      AND (_owner IS NULL OR p.owner_user_id = _owner)
  ), counts AS (SELECT st, count(*) AS n FROM base GROUP BY st),
  f AS (SELECT * FROM base WHERE (_status = 'all' AND st <> 'archived') OR st = _status
                              OR (_status = 'no_owner' AND st <> 'archived' AND owner_user_id IS NULL)),
  pg AS (SELECT id, created_at FROM f ORDER BY created_at DESC, id
         LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0))
  SELECT jsonb_build_object(
    'rows', coalesce((SELECT jsonb_agg(public._party_json(p) ORDER BY pg.created_at DESC, pg.id) FROM pg JOIN public.parties p ON p.id = pg.id), '[]'::jsonb),
    'count', (SELECT count(*) FROM f),
    'counts', coalesce((SELECT jsonb_object_agg(st, n) FROM counts), '{}'::jsonb),
    'no_owner', (SELECT count(*) FROM base WHERE st <> 'archived' AND owner_user_id IS NULL),
    'as_of', now()) INTO _res;
  RETURN _res;
END $$;

CREATE OR REPLACE FUNCTION public.party_history(_id uuid, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c boolean; _strip text[] := ARRAY['phone','phone_key','email','id_number','id_type'];
BEGIN
  IF NOT public.has_permission('customers.names','view') THEN RAISE EXCEPTION 'غير مسموح بعرض سجل العميل'; END IF;
  _c := public.can_read_party_contact(_id);
  RETURN (WITH f AS (
      SELECT a.id, a.action, a.created_at, a.actor_id, a.actor_email, a.context,
             CASE WHEN _c THEN a.before_data ELSE a.before_data - _strip END AS before_data,
             CASE WHEN _c THEN a.after_data ELSE a.after_data - _strip END AS after_data
      FROM public.audit_log a WHERE a.entity_table = 'parties' AND a.entity_id = _id::text),
    p AS (SELECT f.*, pr.display_name AS actor_name FROM f LEFT JOIN public.profiles pr ON pr.user_id = f.actor_id
          ORDER BY f.created_at DESC, f.id LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0))
    SELECT jsonb_build_object('rows', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FROM p), '[]'::jsonb),
                              'count', (SELECT count(*) FROM f)));
END $$;

-- 5) Writers -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.party_upsert(_name text, _phone text DEFAULT NULL, _id_type text DEFAULT NULL,
  _id_number text DEFAULT NULL, _party_type public.party_type DEFAULT NULL, _email text DEFAULT NULL,
  _city text DEFAULT NULL, _source text DEFAULT NULL, _owner uuid DEFAULT NULL, _interested boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d text := regexp_replace(coalesce(_phone,''),'\D','','g'); _k text; _idn text := nullif(btrim(coalesce(_id_number,'')),'');
        _e public.parties; _p public.parties;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بإضافة عميل'; END IF;
  IF length(btrim(coalesce(_name,''))) < 2 THEN RAISE EXCEPTION 'اسم العميل مطلوب'; END IF;
  IF _d <> '' AND length(_d) < 9 THEN RAISE EXCEPTION 'رقم الجوال غير صالح'; END IF;
  IF _d = '' AND _idn IS NULL THEN RAISE EXCEPTION 'أدخل الجوال أو رقم الهوية'; END IF;
  IF _id_type IS NOT NULL AND _id_type NOT IN ('commercial_registration','national_id','iqama') THEN RAISE EXCEPTION 'نوع الهوية غير صالح'; END IF;
  IF _owner IS NOT NULL AND NOT public.task_staff_active(_owner) THEN RAISE EXCEPTION 'الموظف المسؤول غير صالح'; END IF;
  _k := public.party_phone_key(_phone);
  _e := public._party_find(_k, _idn);
  IF _e.id IS NOT NULL THEN
    IF _interested AND _e.interested_at IS NULL THEN
      UPDATE public.parties SET interested_at = now(), closed_at = NULL, closed_by = NULL, close_reason = NULL,
             reopened_at = CASE WHEN closed_at IS NOT NULL THEN now() ELSE reopened_at END
      WHERE id = _e.id RETURNING * INTO _p;
      PERFORM public._safety_audit('PARTY_MARK_INTERESTED','parties',_e.id::text,to_jsonb(_e),to_jsonb(_p),'تسجيل اهتمام لعميل موجود');
    END IF;
    RETURN jsonb_build_object('status','exists','party_id',_e.id,'tenant_code',_e.tenant_code,'name_ar',_e.name_ar,
      'match', CASE WHEN _idn IS NOT NULL AND _e.id_number = _idn THEN 'identity' ELSE 'phone' END);
  END IF;
  _p := public._party_insert(_name, _phone, _email, _id_type, _idn, _party_type, _city, coalesce(nullif(btrim(_source),''),'manual'), _owner, _interested);
  RETURN jsonb_build_object('status','created','party_id',_p.id,'tenant_code',_p.tenant_code,'name_ar',_p.name_ar);
END $$;

CREATE OR REPLACE FUNCTION public.party_update(_id uuid, _patch jsonb, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _k text; _bad text; _other public.parties;
        _allowed text[] := ARRAY['name_ar','name_en','party_type','id_type','id_number','phone','email','city'];
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بتعديل العميل'; END IF;
  IF _patch IS NULL OR jsonb_typeof(_patch) <> 'object' OR _patch = '{}'::jsonb THEN RAISE EXCEPTION 'لا توجد تعديلات'; END IF;
  SELECT k INTO _bad FROM jsonb_object_keys(_patch) k WHERE NOT k = ANY(_allowed) LIMIT 1;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'حقل غير قابل للتعديل: %', _bad; END IF;
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF _b.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'العميل مدموج في ملف آخر'; END IF;
  IF _patch ?| ARRAY['phone','email','id_type','id_number'] AND NOT public.can_read_party_contact(_id) THEN
    RAISE EXCEPTION 'لا يمكنك تعديل بيانات التواصل لهذا العميل'; END IF;
  IF _patch ? 'name_ar' AND length(btrim(coalesce(_patch->>'name_ar',''))) < 2 THEN RAISE EXCEPTION 'اسم العميل مطلوب'; END IF;
  IF _patch ? 'phone' AND coalesce(_patch->>'phone','') <> '' AND length(regexp_replace(_patch->>'phone','\D','','g')) < 9 THEN RAISE EXCEPTION 'رقم الجوال غير صالح'; END IF;
  IF _patch ? 'id_type' AND _patch->>'id_type' IS NOT NULL AND _patch->>'id_type' NOT IN ('commercial_registration','national_id','iqama') THEN RAISE EXCEPTION 'نوع الهوية غير صالح'; END IF;
  IF _patch ? 'party_type' AND _patch->>'party_type' NOT IN ('company','individual') THEN RAISE EXCEPTION 'نوع العميل غير صالح'; END IF;
  _k := CASE WHEN _patch ? 'phone' THEN public.party_phone_key(_patch->>'phone') END;
  IF _k IS NOT NULL OR (_patch ? 'id_number' AND nullif(btrim(coalesce(_patch->>'id_number','')),'') IS NOT NULL) THEN
    SELECT * INTO _other FROM public.parties p
    WHERE p.id <> _id AND p.archived_at IS NULL AND p.merged_into_id IS NULL AND p.duplicate_of_id IS NULL
      AND ((_k IS NOT NULL AND p.phone_key = _k) OR (_patch ? 'id_number' AND p.id_number = nullif(btrim(_patch->>'id_number'),'')))
    LIMIT 1;
    IF _other.id IS NOT NULL THEN RAISE EXCEPTION 'البيانات مسجلة لعميل آخر (%). استخدم «مكرر» بدل التعديل', _other.tenant_code; END IF;
  END IF;
  UPDATE public.parties SET
    name_ar   = CASE WHEN _patch ? 'name_ar'   THEN btrim(_patch->>'name_ar') ELSE name_ar END,
    name_en   = CASE WHEN _patch ? 'name_en'   THEN nullif(btrim(coalesce(_patch->>'name_en','')),'') ELSE name_en END,
    party_type= CASE WHEN _patch ? 'party_type' THEN (_patch->>'party_type')::public.party_type ELSE party_type END,
    id_type   = CASE WHEN _patch ? 'id_type'   THEN nullif(_patch->>'id_type','') ELSE id_type END,
    id_number = CASE WHEN _patch ? 'id_number' THEN nullif(btrim(coalesce(_patch->>'id_number','')),'') ELSE id_number END,
    phone     = CASE WHEN _patch ? 'phone' THEN CASE WHEN _k ~ '^5[0-9]{8}$' THEN '+966' || _k ELSE nullif(btrim(coalesce(_patch->>'phone','')),'') END ELSE phone END,
    email     = CASE WHEN _patch ? 'email'     THEN nullif(btrim(coalesce(_patch->>'email','')),'') ELSE email END,
    city      = CASE WHEN _patch ? 'city'      THEN nullif(btrim(coalesce(_patch->>'city','')),'') ELSE city END
  WHERE id = _id RETURNING * INTO _a;
  PERFORM public._safety_audit('PARTY_UPDATE','parties',_id::text,
    (SELECT jsonb_object_agg(k, to_jsonb(_b)->k) FROM unnest(_allowed) k WHERE to_jsonb(_b)->k IS DISTINCT FROM to_jsonb(_a)->k),
    (SELECT jsonb_object_agg(k, to_jsonb(_a)->k) FROM unnest(_allowed) k WHERE to_jsonb(_b)->k IS DISTINCT FROM to_jsonb(_a)->k),
    coalesce(nullif(btrim(coalesce(_reason,'')),''),'تعديل بيانات العميل'));
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_close(_id uuid, _reason text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _st text; _label text;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بقفل العميل'; END IF;
  IF _reason NOT IN ('not_interested','no_answer','not_suitable','chose_other') THEN RAISE EXCEPTION 'اختر سبب القفل من القائمة'; END IF;
  _label := CASE _reason WHEN 'not_interested' THEN 'مش مهتم' WHEN 'no_answer' THEN 'لا يرد' WHEN 'not_suitable' THEN 'غير مناسب' ELSE 'اختار مكان تاني' END;
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  _st := public.party_status(_b);
  IF _st = 'archived' THEN RAISE EXCEPTION 'العميل مؤرشف'; END IF;
  IF _st IN ('tenant','booker') THEN RAISE EXCEPTION 'لا يمكن قفل عميل عنده حجز ساري أو عقد'; END IF;
  IF _b.closed_at IS NOT NULL THEN RAISE EXCEPTION 'العميل مقفول بالفعل'; END IF;
  UPDATE public.parties SET closed_at = now(), closed_by = auth.uid(), close_reason = _reason WHERE id = _id RETURNING * INTO _a;
  UPDATE public.opportunities SET outcome = _reason::public.opportunity_outcome,
         outcome_reason = coalesce(nullif(btrim(coalesce(_note,'')),''), 'قفل العميل: ' || _label), closed_at = now()
  WHERE party_id = _id AND outcome IS NULL AND stage <> 'won';
  UPDATE public.tasks SET status = 'cancelled', completed_at = now(), outcome_note = 'قفل العميل: ' || _label, updated_at = now()
  WHERE entity_type = 'party' AND entity_id = _id AND status = 'open';
  PERFORM public._safety_audit('PARTY_CLOSE','parties',_id::text,to_jsonb(_b),to_jsonb(_a),
    _label || coalesce(' — ' || nullif(btrim(coalesce(_note,'')),''),''));
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_mark_duplicate(_id uuid, _original uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _o public.parties; _r text;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بتعليم المكرر'; END IF;
  _r := public._assert_reason(_reason);
  IF _id = _original THEN RAISE EXCEPTION 'اختر ملفًا أصليًا مختلفًا'; END IF;
  SELECT * INTO _o FROM public.parties WHERE id = _original;
  IF NOT FOUND OR _o.archived_at IS NOT NULL OR _o.merged_into_id IS NOT NULL OR _o.duplicate_of_id IS NOT NULL THEN
    RAISE EXCEPTION 'الملف الأصلي غير صالح أو مؤرشف'; END IF;
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF _b.archived_at IS NOT NULL OR _b.duplicate_of_id IS NOT NULL OR _b.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'العميل مؤرشف بالفعل'; END IF;
  UPDATE public.parties SET duplicate_of_id = _original, archived_at = now(), archived_by = auth.uid(),
         archive_reason = 'مكرر من ' || _o.tenant_code || ': ' || _r
  WHERE id = _id RETURNING * INTO _a;
  UPDATE public.opportunities SET outcome = 'duplicate', outcome_reason = 'مكرر من ' || _o.tenant_code, closed_at = now()
  WHERE party_id = _id AND outcome IS NULL AND stage <> 'won';
  IF _b.do_not_contact AND NOT _o.do_not_contact THEN
    UPDATE public.parties SET do_not_contact = true, do_not_contact_at = now(), do_not_contact_by = auth.uid(),
           do_not_contact_reason = coalesce(_b.do_not_contact_reason, 'منقول من الملف المكرر ' || _b.tenant_code)
    WHERE id = _original;
  END IF;
  UPDATE public.duplicate_candidates SET status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution_notes = _r
  WHERE status <> 'resolved' AND ((party_id = _id AND candidate_party_id = _original) OR (party_id = _original AND candidate_party_id = _id));
  PERFORM public._safety_audit('PARTY_MARK_DUPLICATE','parties',_id::text,to_jsonb(_b),to_jsonb(_a),_r);
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_restore_duplicate(_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _r text;
BEGIN
  IF NOT (public.has_permission('opportunities.write','edit') OR public.has_permission('customers.merge','approve')) THEN
    RAISE EXCEPTION 'إلغاء علامة المكرر لمدير التأجير أو الأدمن'; END IF;
  _r := public._assert_reason(_reason);
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR _b.duplicate_of_id IS NULL THEN RAISE EXCEPTION 'العميل غير معلّم كمكرر'; END IF;
  IF _b.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'العميل مدموج؛ استخدم «تراجع عن الدمج»'; END IF;
  UPDATE public.parties SET duplicate_of_id = NULL, archived_at = NULL, archived_by = NULL, archive_reason = NULL
  WHERE id = _id RETURNING * INTO _a;
  PERFORM public._safety_audit('PARTY_RESTORE_DUPLICATE','parties',_id::text,to_jsonb(_b),to_jsonb(_a),_r);
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_merge(_from uuid, _into uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.parties; _i public.parties; _r text; _moved jsonb := '{}'::jsonb; _ids uuid[]; _m uuid; _a public.parties;
BEGIN
  IF NOT (public.has_permission('customers.merge','approve') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'الدمج الكامل للأدمن فقط'; END IF;
  _r := public._assert_reason(_reason);
  IF _from = _into THEN RAISE EXCEPTION 'لا يمكن دمج الملف في نفسه'; END IF;
  SELECT * INTO _f FROM public.parties WHERE id = _from FOR UPDATE;
  SELECT * INTO _i FROM public.parties WHERE id = _into FOR UPDATE;
  IF _f.id IS NULL OR _i.id IS NULL THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF _f.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'الملف مدموج بالفعل'; END IF;
  IF _i.archived_at IS NOT NULL OR _i.merged_into_id IS NOT NULL OR _i.duplicate_of_id IS NOT NULL THEN RAISE EXCEPTION 'الملف الأصلي مؤرشف؛ اختر الملف الساري'; END IF;
  IF EXISTS (SELECT 1 FROM public.contracts WHERE party_id = _from) OR EXISTS (SELECT 1 FROM public.receipts WHERE party_id = _from)
     OR EXISTS (SELECT 1 FROM public.tenants WHERE party_id = _from AND archived_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.tenant_accounts WHERE party_id = _from AND archived_at IS NULL AND merged_into_id IS NULL) THEN
    RAISE EXCEPTION 'الملف عليه عقود أو سندات أو حساب مستأجر؛ ادمج حسابات المستأجرين أولًا من صفحتها، أو علّمه كمكرر فقط';
  END IF;
  _moved := jsonb_build_object('before_from', jsonb_build_object('archived_at',_f.archived_at,'archived_by',_f.archived_by,
             'archive_reason',_f.archive_reason,'duplicate_of_id',_f.duplicate_of_id), 'into_dnc_changed', false);
  WITH u AS (UPDATE public.bookings SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('bookings', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.opportunities SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('opportunities', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.party_activities SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('party_activities', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.party_contacts SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('party_contacts', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.leads SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('leads', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.interested_customers SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('interested_customers', coalesce(to_jsonb(_ids),'[]'::jsonb));
  WITH u AS (UPDATE public.customer_profiles SET party_id = _into WHERE party_id = _from RETURNING id) SELECT array_agg(id) INTO _ids FROM u;
  _moved := _moved || jsonb_build_object('customer_profiles', coalesce(to_jsonb(_ids),'[]'::jsonb));
  IF _f.do_not_contact AND NOT _i.do_not_contact THEN
    UPDATE public.parties SET do_not_contact = true, do_not_contact_at = now(), do_not_contact_by = auth.uid(),
           do_not_contact_reason = coalesce(_f.do_not_contact_reason, 'منقول من الملف المدموج ' || _f.tenant_code) WHERE id = _into;
    _moved := _moved || jsonb_build_object('into_dnc_changed', true);
  END IF;
  UPDATE public.parties SET merged_into_id = _into, duplicate_of_id = coalesce(duplicate_of_id, _into),
         archived_at = coalesce(archived_at, now()), archived_by = coalesce(archived_by, auth.uid()),
         archive_reason = 'مدموج في ' || _i.tenant_code || ': ' || _r
  WHERE id = _from RETURNING * INTO _a;
  INSERT INTO public.party_merges (from_party_id, into_party_id, moved, reason, merged_by)
  VALUES (_from, _into, _moved, _r, auth.uid()) RETURNING id INTO _m;
  PERFORM public._safety_audit('PARTY_MERGE','parties',_from::text,to_jsonb(_f),to_jsonb(_a) || jsonb_build_object('merge_id',_m,'moved',_moved),_r);
  PERFORM public._safety_audit('PARTY_MERGE_RECEIVED','parties',_into::text,NULL,jsonb_build_object('merge_id',_m,'from',_f.tenant_code,'moved',_moved),_r);
  RETURN jsonb_build_object('merge_id', _m, 'moved', _moved);
END $$;

CREATE OR REPLACE FUNCTION public.party_unmerge(_merge_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.party_merges; _r text; _b public.parties; _a public.parties; _bf jsonb;
BEGIN
  IF NOT (public.has_permission('customers.merge','approve') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'التراجع عن الدمج للأدمن فقط'; END IF;
  _r := public._assert_reason(_reason);
  SELECT * INTO _m FROM public.party_merges WHERE id = _merge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'عملية الدمج غير موجودة'; END IF;
  IF _m.undone_at IS NOT NULL THEN RAISE EXCEPTION 'تم التراجع عن هذا الدمج بالفعل'; END IF;
  UPDATE public.bookings SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'bookings')::uuid);
  UPDATE public.opportunities SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'opportunities')::uuid);
  UPDATE public.party_activities SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'party_activities')::uuid);
  UPDATE public.party_contacts SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'party_contacts')::uuid);
  UPDATE public.leads SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'leads')::uuid);
  UPDATE public.interested_customers SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'interested_customers')::uuid);
  UPDATE public.customer_profiles SET party_id = _m.from_party_id WHERE party_id = _m.into_party_id AND id IN (SELECT jsonb_array_elements_text(_m.moved->'customer_profiles')::uuid);
  IF coalesce((_m.moved->>'into_dnc_changed')::boolean, false) THEN
    UPDATE public.parties SET do_not_contact = false, do_not_contact_at = NULL, do_not_contact_by = NULL, do_not_contact_reason = NULL WHERE id = _m.into_party_id;
  END IF;
  _bf := _m.moved->'before_from';
  SELECT * INTO _b FROM public.parties WHERE id = _m.from_party_id FOR UPDATE;
  UPDATE public.parties SET merged_into_id = NULL,
         archived_at = (_bf->>'archived_at')::timestamptz, archived_by = (_bf->>'archived_by')::uuid,
         archive_reason = _bf->>'archive_reason', duplicate_of_id = (_bf->>'duplicate_of_id')::uuid
  WHERE id = _m.from_party_id RETURNING * INTO _a;
  UPDATE public.party_merges SET undone_at = now(), undone_by = auth.uid(), undo_reason = _r WHERE id = _merge_id;
  PERFORM public._safety_audit('PARTY_UNMERGE','parties',_m.from_party_id::text,to_jsonb(_b),to_jsonb(_a),_r);
  PERFORM public._safety_audit('PARTY_UNMERGE_RETURNED','parties',_m.into_party_id::text,NULL,jsonb_build_object('merge_id',_merge_id),_r);
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_set_do_not_contact(_id uuid, _on boolean, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _r text;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  _r := public._assert_reason(_reason);
  IF NOT _on AND NOT (public.has_permission('opportunities.write','edit')) THEN RAISE EXCEPTION 'إلغاء «لا يُتواصل معه» لمدير التأجير أو الأدمن'; END IF;
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF _b.do_not_contact = _on THEN RETURN public._party_json(_b); END IF;
  UPDATE public.parties SET do_not_contact = _on,
         do_not_contact_at = CASE WHEN _on THEN now() END, do_not_contact_by = CASE WHEN _on THEN auth.uid() END,
         do_not_contact_reason = CASE WHEN _on THEN _r END
  WHERE id = _id RETURNING * INTO _a;
  PERFORM public._safety_audit(CASE WHEN _on THEN 'PARTY_DO_NOT_CONTACT_ON' ELSE 'PARTY_DO_NOT_CONTACT_OFF' END,'parties',_id::text,to_jsonb(_b),to_jsonb(_a),_r);
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.party_set_owner(_id uuid, _owner uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties;
BEGIN
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  IF NOT (public.has_permission('opportunities.assign','edit')
          OR (public.party_can_write() AND _b.owner_user_id IS NULL AND _owner = auth.uid())) THEN
    RAISE EXCEPTION 'تغيير المسؤول لمدير التأجير أو الأدمن؛ تقدر تستلم العميل لنفسك لو مالوش مسؤول'; END IF;
  IF _owner IS NOT NULL AND NOT public.task_staff_active(_owner) THEN RAISE EXCEPTION 'الموظف غير صالح'; END IF;
  UPDATE public.parties SET owner_user_id = _owner WHERE id = _id RETURNING * INTO _a;
  UPDATE public.tasks SET assignee_user_id = _owner, visibility = CASE WHEN _owner IS NULL THEN 'team' ELSE 'operational' END, updated_at = now()
  WHERE entity_type = 'party' AND entity_id = _id AND status = 'open' AND visibility IN ('team','operational');
  PERFORM public._safety_audit('PARTY_SET_OWNER','parties',_id::text,jsonb_build_object('owner_user_id',_b.owner_user_id),
    jsonb_build_object('owner_user_id',_a.owner_user_id),coalesce(nullif(btrim(coalesce(_reason,'')),''),'تغيير المسؤول'));
  RETURN public._party_json(_a);
END $$;

CREATE OR REPLACE FUNCTION public.convert_target_to_interested(_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _st text;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  SELECT * INTO _b FROM public.parties WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير موجود'; END IF;
  _st := public.party_status(_b);
  IF _st = 'archived' THEN RAISE EXCEPTION 'العميل مؤرشف'; END IF;
  IF _b.do_not_contact THEN RAISE EXCEPTION 'العميل معلّم «لا يُتواصل معه»'; END IF;
  UPDATE public.parties SET interested_at = coalesce(interested_at, now()),
         closed_at = NULL, closed_by = NULL, close_reason = NULL,
         reopened_at = CASE WHEN closed_at IS NOT NULL THEN now() ELSE reopened_at END
  WHERE id = _id RETURNING * INTO _a;
  IF NOT EXISTS (SELECT 1 FROM public.opportunities WHERE party_id = _id AND outcome IS NULL AND stage <> 'won') THEN
    PERFORM public.create_opportunity(_id, NULL, NULL, 'target_list'::public.opportunity_source, _a.owner_user_id, _note, NULL, NULL);
  END IF;
  PERFORM public._safety_audit('PARTY_CONVERT_INTERESTED','parties',_id::text,to_jsonb(_b),to_jsonb(_a),coalesce(nullif(btrim(coalesce(_note,'')),''),'تحويل لمهتم'));
  RETURN public._party_json(_a);
END $$;

-- Imports: one batch per file with a preview before apply. Never touches do-not-contact.
CREATE OR REPLACE FUNCTION public.party_import_preview(_source text, _file_name text, _rows jsonb, _owner uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b uuid; _r record; _name text; _phone text; _d text; _k text; _idn text; _idt text; _act text; _why text; _pid uuid;
        _seen text[] := ARRAY[]::text[]; _key text; _e public.parties;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بالاستيراد'; END IF;
  IF length(btrim(coalesce(_source,''))) < 2 THEN RAISE EXCEPTION 'اكتب اسم المصدر'; END IF;
  IF _rows IS NULL OR jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'الملف فاضي'; END IF;
  IF jsonb_array_length(_rows) > 5000 THEN RAISE EXCEPTION 'الحد الأقصى 5000 صف في الدفعة'; END IF;
  IF _owner IS NOT NULL AND NOT public.task_staff_active(_owner) THEN RAISE EXCEPTION 'الموظف المسؤول غير صالح'; END IF;
  INSERT INTO public.party_import_batches (source, file_name, created_by, owner_user_id)
  VALUES (btrim(_source), nullif(btrim(coalesce(_file_name,'')),''), auth.uid(), _owner) RETURNING id INTO _b;
  FOR _r IN SELECT value AS v, ordinality AS n FROM jsonb_array_elements(_rows) WITH ORDINALITY LOOP
    _name := btrim(coalesce(_r.v->>'full_name', _r.v->>'name', ''));
    _phone := btrim(coalesce(_r.v->>'phone', ''));
    _d := regexp_replace(_phone,'\D','','g');
    _k := public.party_phone_key(_phone);
    _idn := nullif(btrim(coalesce(_r.v->>'id_number','')),'');
    _idt := nullif(btrim(coalesce(_r.v->>'id_type','')),'');
    IF _idt IS NOT NULL AND _idt NOT IN ('commercial_registration','national_id','iqama') THEN _idt := NULL; END IF;
    _act := 'new'; _why := NULL; _pid := NULL;
    _key := coalesce(_k, 'id:' || _idn);
    IF length(_name) < 2 THEN _act := 'invalid'; _why := 'الاسم ناقص';
    ELSIF _d <> '' AND length(_d) < 9 THEN _act := 'invalid'; _why := 'رقم الجوال غير صالح';
    ELSIF _k IS NULL AND _idn IS NULL THEN _act := 'invalid'; _why := 'لا يوجد جوال أو هوية';
    ELSIF _key = ANY(_seen) THEN _act := 'duplicate_in_file'; _why := 'مكرر داخل الملف';
    ELSE
      _e := public._party_find(_k, _idn);
      IF _e.id IS NOT NULL THEN _act := 'existing'; _pid := _e.id; _why := 'موجود: ' || _e.tenant_code || CASE WHEN _e.do_not_contact THEN ' — لا يُتواصل معه' ELSE '' END; END IF;
    END IF;
    IF _act IN ('new','existing') THEN _seen := _seen || _key; END IF;
    INSERT INTO public.party_import_rows (batch_id, row_no, full_name, phone, phone_key, id_type, id_number, city, notes, action, reason, party_id)
    VALUES (_b, _r.n, nullif(_name,''), nullif(_phone,''), _k, _idt, _idn, nullif(btrim(coalesce(_r.v->>'city','')),''),
            nullif(btrim(coalesce(_r.v->>'notes','')),''), _act, _why, _pid);
  END LOOP;
  UPDATE public.party_import_batches SET summary = (SELECT jsonb_object_agg(action, n) FROM (SELECT action, count(*) n FROM public.party_import_rows WHERE batch_id = _b GROUP BY action) s)
  WHERE id = _b;
  PERFORM public._safety_audit('PARTY_IMPORT_PREVIEW','party_import_batches',_b::text,NULL,(SELECT to_jsonb(x) FROM public.party_import_batches x WHERE id = _b),'معاينة استيراد');
  RETURN (SELECT jsonb_build_object('batch_id', _b, 'summary', summary) FROM public.party_import_batches WHERE id = _b);
END $$;

CREATE OR REPLACE FUNCTION public.party_import_apply(_batch uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bt public.party_import_batches; _r public.party_import_rows; _e public.parties; _p public.parties; _created int := 0; _linked int := 0;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح بالاستيراد'; END IF;
  SELECT * INTO _bt FROM public.party_import_batches WHERE id = _batch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الدفعة غير موجودة'; END IF;
  IF _bt.status <> 'preview' THEN RAISE EXCEPTION 'الدفعة طُبّقت أو أُلغيت بالفعل'; END IF;
  IF _bt.created_by IS DISTINCT FROM auth.uid() AND NOT public.has_permission('opportunities.write','edit') THEN RAISE EXCEPTION 'تطبيق الدفعة لصاحبها أو لمدير التأجير'; END IF;
  FOR _r IN SELECT * FROM public.party_import_rows WHERE batch_id = _batch AND action IN ('new','existing') AND NOT applied ORDER BY row_no FOR UPDATE LOOP
    _e := public._party_find(_r.phone_key, _r.id_number);
    IF _e.id IS NOT NULL THEN
      UPDATE public.party_import_rows SET applied = true, party_id = _e.id, action = 'existing',
             reason = coalesce(reason, 'موجود: ' || _e.tenant_code) WHERE id = _r.id;
      _linked := _linked + 1;
    ELSE
      _p := public._party_insert(_r.full_name, _r.phone, NULL, _r.id_type, _r.id_number, NULL, _r.city, 'import: ' || _bt.source, _bt.owner_user_id, false);
      UPDATE public.party_import_rows SET applied = true, party_id = _p.id WHERE id = _r.id;
      _created := _created + 1;
    END IF;
  END LOOP;
  UPDATE public.party_import_batches SET status = 'applied', applied_by = auth.uid(), applied_at = now(),
         summary = summary || jsonb_build_object('created', _created, 'linked', _linked)
  WHERE id = _batch RETURNING * INTO _bt;
  PERFORM public._safety_audit('PARTY_IMPORT_APPLY','party_import_batches',_batch::text,NULL,to_jsonb(_bt),'تطبيق دفعة استيراد');
  RETURN jsonb_build_object('batch_id', _batch, 'created', _created, 'linked', _linked);
END $$;

CREATE OR REPLACE FUNCTION public.party_import_cancel(_batch uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bt public.party_import_batches;
BEGIN
  IF NOT public.party_can_write() THEN RAISE EXCEPTION 'غير مسموح'; END IF;
  SELECT * INTO _bt FROM public.party_import_batches WHERE id = _batch FOR UPDATE;
  IF NOT FOUND OR _bt.status <> 'preview' THEN RAISE EXCEPTION 'الدفعة غير قابلة للإلغاء'; END IF;
  UPDATE public.party_import_batches SET status = 'cancelled' WHERE id = _batch;
  PERFORM public._safety_audit('PARTY_IMPORT_CANCEL','party_import_batches',_batch::text,to_jsonb(_bt),NULL,'إلغاء دفعة استيراد');
END $$;

-- 6) Existing writers now use the same phone-key dedupe -----------------------
CREATE OR REPLACE FUNCTION public.crm_ensure_party(_name text, _phone text, _email text, _id_type text, _id_number text, _source text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.parties; _p public.parties; _idn text := nullif(btrim(coalesce(_id_number,'')),'');
BEGIN
  _e := public._party_find(public.party_phone_key(_phone), _idn);
  IF _e.id IS NOT NULL THEN RETURN _e.id; END IF;
  IF public.party_phone_key(_phone) IS NULL AND _idn IS NULL AND nullif(btrim(coalesce(_phone,'')),'') IS NOT NULL THEN
    SELECT * INTO _e FROM public.parties WHERE phone = btrim(_phone) AND archived_at IS NULL AND merged_into_id IS NULL LIMIT 1;
    IF FOUND THEN RETURN _e.id; END IF;
  END IF;
  _p := public._party_insert(_name, _phone, _email, _id_type, _idn, NULL, NULL, _source, NULL, false);
  RETURN _p.id;
END $$;

CREATE OR REPLACE FUNCTION public.create_party(_name_ar text, _party_type public.party_type DEFAULT 'individual'::public.party_type,
  _id_type text DEFAULT NULL, _id_number text DEFAULT NULL, _phone text DEFAULT NULL, _email text DEFAULT NULL,
  _city text DEFAULT NULL, _source text DEFAULT NULL, _name_en text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb; _p public.parties; _owner uuid;
BEGIN
  _r := public.party_upsert(_name_ar, _phone, _id_type, _id_number, _party_type, _email, _city, _source, NULL, false);
  SELECT * INTO _p FROM public.parties WHERE id = (_r->>'party_id')::uuid;
  IF _r->>'status' = 'created' AND _name_en IS NOT NULL THEN UPDATE public.parties SET name_en = _name_en WHERE id = _p.id RETURNING * INTO _p; END IF;
  IF _r->>'status' = 'exists' THEN
    SELECT owner_user_id INTO _owner FROM public.opportunities WHERE party_id = _p.id AND outcome IS NULL ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('status','exists','match',_r->>'match','party',to_jsonb(_p),'owner_user_id',coalesce(_owner,_p.owner_user_id));
  END IF;
  RETURN jsonb_build_object('status','created','party',to_jsonb(_p));
END $$;

-- Every new interested/lead row is linked to the unified customer at insert time (Telegram, pages, sheets).
CREATE OR REPLACE FUNCTION public.crm_link_source_party()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties;
BEGIN
  IF NEW.party_id IS NULL AND nullif(btrim(coalesce(NEW.phone,'')),'') IS NOT NULL THEN
    IF TG_TABLE_NAME = 'leads' THEN
      NEW.party_id := public.crm_ensure_party(NEW.full_name, NEW.phone, NULL, NULL, NULL, 'lead');
    ELSE
      NEW.party_id := public.crm_ensure_party(NEW.full_name, NEW.phone, NULL, NULL, NULL, 'interested:' || coalesce(NEW.source,'manual'));
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'interested_customers' AND NEW.party_id IS NOT NULL THEN
    SELECT * INTO _b FROM public.parties WHERE id = NEW.party_id FOR UPDATE;
    IF _b.interested_at IS NULL OR _b.closed_at IS NOT NULL THEN
      UPDATE public.parties SET interested_at = coalesce(interested_at, now()), closed_at = NULL, closed_by = NULL, close_reason = NULL,
             reopened_at = CASE WHEN closed_at IS NOT NULL THEN now() ELSE reopened_at END
      WHERE id = NEW.party_id RETURNING * INTO _a;
      PERFORM public._safety_audit('PARTY_MARK_INTERESTED','parties',_a.id::text,to_jsonb(_b),to_jsonb(_a),'تسجيل اهتمام جديد');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_link_party_trg ON public.interested_customers;
CREATE TRIGGER crm_link_party_trg BEFORE INSERT ON public.interested_customers FOR EACH ROW EXECUTE FUNCTION public.crm_link_source_party();
DROP TRIGGER IF EXISTS crm_link_party_trg ON public.leads;
CREATE TRIGGER crm_link_party_trg BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_link_source_party();

-- A new opportunity re-opens a closed customer.
CREATE OR REPLACE FUNCTION public.crm_party_reopen_on_opportunity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties;
BEGIN
  SELECT * INTO _b FROM public.parties WHERE id = NEW.party_id FOR UPDATE;
  IF _b.closed_at IS NOT NULL AND NEW.outcome IS NULL THEN
    UPDATE public.parties SET closed_at = NULL, closed_by = NULL, close_reason = NULL, reopened_at = now() WHERE id = NEW.party_id RETURNING * INTO _a;
    PERFORM public._safety_audit('PARTY_REOPEN','parties',_a.id::text,to_jsonb(_b),to_jsonb(_a),'فرصة جديدة للعميل');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_party_reopen_trg ON public.opportunities;
CREATE TRIGGER crm_party_reopen_trg AFTER INSERT ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_party_reopen_on_opportunity();

-- When the last open opportunity is lost for one of the four reasons, the customer is closed with that reason.
CREATE OR REPLACE FUNCTION public.crm_party_close_on_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties;
BEGIN
  IF OLD.outcome IS NULL AND NEW.outcome IS NOT NULL AND NEW.outcome::text IN ('not_interested','no_answer','not_suitable','chose_other') THEN
    SELECT * INTO _b FROM public.parties WHERE id = NEW.party_id FOR UPDATE;
    IF _b.closed_at IS NULL AND _b.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = NEW.party_id AND o.id <> NEW.id AND o.outcome IS NULL AND o.stage <> 'won')
       AND public.party_status(_b) NOT IN ('tenant','booker') THEN
      UPDATE public.parties SET closed_at = now(), closed_by = auth.uid(), close_reason = NEW.outcome::text WHERE id = NEW.party_id RETURNING * INTO _a;
      PERFORM public._safety_audit('PARTY_CLOSE_FROM_OPPORTUNITY','parties',_a.id::text,to_jsonb(_b),to_jsonb(_a),coalesce(NEW.outcome_reason,NEW.outcome::text));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_party_close_trg ON public.opportunities;
CREATE TRIGGER crm_party_close_trg AFTER UPDATE OF outcome ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.crm_party_close_on_outcome();

-- 10 recorded no-answer attempts on a customer without an open opportunity close it as «لا يرد».
CREATE OR REPLACE FUNCTION public.crm_party_no_answer_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b public.parties; _a public.parties; _n integer;
BEGIN
  IF NEW.outcome = 'no_answer' THEN
    SELECT * INTO _b FROM public.parties WHERE id = NEW.party_id FOR UPDATE;
    SELECT count(*) INTO _n FROM public.party_activities WHERE party_id = NEW.party_id AND outcome = 'no_answer'
      AND created_at > coalesce(_b.reopened_at, '-infinity'::timestamptz);
    IF _n >= 10 AND _b.closed_at IS NULL AND _b.archived_at IS NULL AND public.party_status(_b) NOT IN ('tenant','booker') THEN
      UPDATE public.parties SET closed_at = now(), closed_by = auth.uid(), close_reason = 'no_answer' WHERE id = NEW.party_id RETURNING * INTO _a;
      PERFORM public._safety_audit('PARTY_AUTO_CLOSE_NO_ANSWER','parties',_a.id::text,to_jsonb(_b),to_jsonb(_a),'إغلاق تلقائي: 10 محاولات بدون رد');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_party_no_answer_trg ON public.party_activities;
CREATE TRIGGER crm_party_no_answer_trg AFTER INSERT ON public.party_activities FOR EACH ROW EXECUTE FUNCTION public.crm_party_no_answer_close();

-- Contact log: follow-ups go to the customer's owner, or to the shared team list when there is none.
CREATE OR REPLACE FUNCTION public.log_party_activity(_party uuid, _type public.opportunity_activity_type, _outcome public.opportunity_activity_outcome, _notes text, _next text, _at timestamp with time zone)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k uuid; o uuid; _owner uuid;
BEGIN
  IF NOT public.can_read_party_contact(_party) OR NOT public.party_can_write() THEN RAISE EXCEPTION 'التواصل لعملائك فقط'; END IF;
  IF length(coalesce(_notes,'')) > 2000 OR (_at IS NOT NULL AND _next IS NULL) THEN RAISE EXCEPTION 'بيانات متابعة غير صالحة'; END IF;
  IF EXISTS (SELECT 1 FROM public.parties WHERE id = _party AND (archived_at IS NOT NULL OR merged_into_id IS NOT NULL)) THEN RAISE EXCEPTION 'العميل مؤرشف'; END IF;
  SELECT id INTO o FROM public.opportunities WHERE party_id = _party AND outcome IS NULL AND stage <> 'won'
    AND (owner_user_id = auth.uid() OR public.has_permission('opportunities.write','edit')) ORDER BY created_at DESC LIMIT 1;
  IF o IS NOT NULL THEN PERFORM public.log_opportunity_activity(o,_type,_outcome,_notes,_next,_at); RETURN o; END IF;
  INSERT INTO public.party_activities(party_id,activity_type,outcome,notes,next_action,next_action_at,actor_id)
  VALUES(_party,_type,_outcome,_notes,_next,_at,auth.uid()) RETURNING id INTO k;
  IF _at IS NOT NULL THEN
    SELECT owner_user_id INTO _owner FROM public.parties WHERE id = _party;
    IF _owner IS NOT NULL AND public.task_staff_active(_owner) THEN
      PERFORM public._task_upsert('party-followup:'||k,'متابعة العميل','party_followup',_owner,_at,'party',_party,'operational');
    ELSE
      PERFORM public._task_upsert('party-followup:'||k,'متابعة العميل (قائمة مشتركة)','party_followup',NULL,_at,'party',_party,'team');
    END IF;
  END IF;
  PERFORM public._safety_audit('PARTY_ACTIVITY','party_activities',k::text,NULL,jsonb_build_object('party_id',_party,'type',_type,'outcome',_outcome,'next_action_at',_at),'تسجيل تواصل العميل');
  RETURN k;
END $$;

-- Shared team tasks are readable/closable by every active sales staff member.
CREATE OR REPLACE FUNCTION public.task_can_read(_task public.tasks)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.task_staff_active(auth.uid()) AND NOT public.has_role(auth.uid(),'investor') AND NOT public.has_role(auth.uid(),'tenant') AND NOT public.has_role(auth.uid(),'user')
   AND (public.has_permission('tasks.manage','view')
        OR (_task.assignee_user_id = auth.uid() AND public.has_permission('tasks.own','own'))
        OR (_task.visibility = 'team' AND _task.assignee_user_id IS NULL AND public.has_permission('tasks.own','own') AND public.party_can_write()))
   AND CASE _task.visibility WHEN 'financial' THEN public.finance_can_read()
        WHEN 'escalation' THEN public.has_role(auth.uid(),'leasing_manager') OR public.has_role(auth.uid(),'admin') ELSE true END
   AND NOT (public.has_role(auth.uid(),'sales_agent') AND _task.visibility NOT IN ('operational','team'))
   AND CASE
     WHEN _task.visibility = 'team' AND _task.assignee_user_id IS NULL THEN true
     WHEN public.has_role(auth.uid(),'sales_agent') AND _task.entity_type = 'opportunity' THEN EXISTS(SELECT 1 FROM public.opportunities o WHERE o.id = _task.entity_id AND o.owner_user_id = auth.uid())
     WHEN public.has_role(auth.uid(),'sales_agent') AND _task.entity_type = 'party' THEN
       EXISTS(SELECT 1 FROM public.opportunities o WHERE o.party_id = _task.entity_id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)
       OR EXISTS(SELECT 1 FROM public.parties p WHERE p.id = _task.entity_id AND p.owner_user_id = auth.uid())
     WHEN public.has_role(auth.uid(),'sales_agent') AND _task.entity_type = 'booking' THEN EXISTS(SELECT 1 FROM public.opportunities o WHERE o.booking_id = _task.entity_id AND o.owner_user_id = auth.uid())
     ELSE true END
$$;

CREATE OR REPLACE FUNCTION public.set_task_state(_id uuid, _status text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tasks;
BEGIN
  PERFORM public._assert_reason(_note);
  IF _status NOT IN ('done','cancelled') THEN RAISE EXCEPTION 'اختر منجزة أو ملغاة'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR NOT public.task_can_read(t) OR NOT (public.has_permission('tasks.manage','edit')
     OR (t.assignee_user_id = auth.uid() AND public.has_permission('tasks.own','own') AND NOT public.has_role(auth.uid(),'manager'))
     OR (t.visibility = 'team' AND t.assignee_user_id IS NULL AND public.has_permission('tasks.own','own') AND public.party_can_write())) THEN
    RAISE EXCEPTION 'غير مسموح بتعديل المهمة'; END IF;
  IF t.status <> 'open' THEN RAISE EXCEPTION 'المهمة مغلقة بالفعل'; END IF;
  UPDATE public.tasks SET status = _status, completed_at = now(), outcome_note = _note, updated_at = now() WHERE id = t.id;
  PERFORM public._safety_audit('TASK_STATE_CHANGED','tasks',t.id::text,to_jsonb(t),(SELECT to_jsonb(x) FROM public.tasks x WHERE id = t.id),_note);
END $$;

CREATE OR REPLACE FUNCTION public.tasks_page(_status text DEFAULT 'open', _search text DEFAULT '', _offset integer DEFAULT 0,
  _limit integer DEFAULT 25, _today boolean DEFAULT false, _team boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'سجل الدخول'; END IF;
  IF _team AND NOT public.has_permission('tasks.manage','view') THEN RAISE EXCEPTION 'مهام الفريق غير مسموحة'; END IF;
  WITH f AS (SELECT t.* FROM public.tasks t WHERE public.task_can_read(t)
               AND (_team OR t.assignee_user_id = auth.uid() OR (t.visibility = 'team' AND t.assignee_user_id IS NULL))
               AND (_status = 'all' OR t.status = _status) AND (_search = '' OR t.title ILIKE '%' || _search || '%')
               AND (NOT _today OR ((t.assignee_user_id = auth.uid() OR (t.visibility = 'team' AND t.assignee_user_id IS NULL))
                    AND t.due_at < ((now() AT TIME ZONE 'Asia/Riyadh')::date + 1)::timestamp AT TIME ZONE 'Asia/Riyadh'))),
       p AS (SELECT * FROM f ORDER BY due_at, id LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0))
  SELECT jsonb_build_object('rows', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM p), '[]'), 'count', (SELECT count(*) FROM f), 'as_of', now()) INTO result;
  RETURN result;
END $$;

-- 7) Backfill (idempotent) -----------------------------------------------------
UPDATE public.parties p SET owner_user_id = o.owner_user_id
FROM (SELECT DISTINCT ON (party_id) party_id, owner_user_id FROM public.opportunities
      WHERE outcome IS NULL AND stage <> 'won' AND owner_user_id IS NOT NULL ORDER BY party_id, created_at DESC) o
WHERE p.id = o.party_id AND p.owner_user_id IS NULL;

UPDATE public.parties p SET interested_at = i.first_at
FROM (SELECT party_id, min(created_at) AS first_at FROM public.interested_customers WHERE party_id IS NOT NULL AND archived_at IS NULL GROUP BY party_id) i
WHERE p.id = i.party_id AND p.interested_at IS NULL;

UPDATE public.parties p SET closed_at = x.last_closed, close_reason = CASE WHEN x.last_outcome IN ('not_interested','no_answer','not_suitable','chose_other') THEN x.last_outcome END
FROM (SELECT party_id, max(coalesce(closed_at, updated_at)) AS last_closed,
             (array_agg(outcome::text ORDER BY coalesce(closed_at, updated_at) DESC))[1] AS last_outcome
      FROM public.opportunities GROUP BY party_id
      HAVING bool_and(outcome IS NOT NULL) AND NOT bool_or(stage = 'won') AND bool_or(outcome::text <> 'duplicate')) x
WHERE p.id = x.party_id AND p.closed_at IS NULL AND p.archived_at IS NULL;

UPDATE public.interested_customers SET party_id = public.crm_ensure_party(full_name, phone, NULL, NULL, NULL, 'interested:' || coalesce(source,'manual'))
WHERE party_id IS NULL AND nullif(btrim(coalesce(phone,'')),'') IS NOT NULL;
UPDATE public.leads SET party_id = public.crm_ensure_party(full_name, phone, NULL, NULL, NULL, 'lead')
WHERE party_id IS NULL AND nullif(btrim(coalesce(phone,'')),'') IS NOT NULL;

-- 8) Grants --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._party_find(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._party_insert(text, text, text, text, text, public.party_type, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._party_json(public.parties) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_link_source_party() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_party_reopen_on_opportunity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_party_close_on_outcome() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_party_no_answer_close() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_ensure_party(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.party_status(public.parties) FROM PUBLIC, anon;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.party_get(uuid)','public.party_directory_page(text, text, uuid, integer, integer)','public.party_history(uuid, integer, integer)',
    'public.party_upsert(text, text, text, text, public.party_type, text, text, text, uuid, boolean)','public.party_update(uuid, jsonb, text)',
    'public.party_close(uuid, text, text)','public.party_mark_duplicate(uuid, uuid, text)','public.party_restore_duplicate(uuid, text)',
    'public.party_merge(uuid, uuid, text)','public.party_unmerge(uuid, text)','public.party_set_do_not_contact(uuid, boolean, text)',
    'public.party_set_owner(uuid, uuid, text)','public.convert_target_to_interested(uuid, text)',
    'public.party_import_preview(text, text, jsonb, uuid)','public.party_import_apply(uuid)','public.party_import_cancel(uuid)',
    'public.party_can_write()','public.party_phone_key(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- 9) Verification (run any time) ----------------------------------------------
SELECT
  (SELECT count(*) FROM public.parties WHERE phone IS NOT NULL AND phone_key IS NULL) AS parties_unkeyable_phones,
  (SELECT count(*) FROM public.interested_customers WHERE party_id IS NULL) AS interested_unlinked,
  (SELECT count(*) FROM public.leads WHERE party_id IS NULL) AS leads_unlinked,
  (SELECT count(*) FROM public.parties WHERE owner_user_id IS NOT NULL) AS parties_with_owner,
  (SELECT count(*) FROM public.parties WHERE closed_at IS NOT NULL) AS parties_closed;