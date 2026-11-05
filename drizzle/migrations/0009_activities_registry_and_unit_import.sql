-- ========== 1. Activities registry ==========
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  short_name text,
  description text,
  marker text,
  unit_type text NOT NULL CHECK (unit_type IN ('workshop','warehouse','shop','showroom','restaurant','service')),
  risk_class text CHECK (risk_class IS NULL OR risk_class IN ('low','medium','high')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activities' AND policyname='Admins and managers view activities') THEN
    CREATE POLICY "Admins and managers view activities" ON public.activities FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

INSERT INTO public.activities (code, name_ar, short_name, description, marker, unit_type, risk_class, sort_order) VALUES
 ('service','ورش صيانة السيارات','صيانة السيارات','مباني 1 إلى 6 ومبنى 11','صيانة','workshop',NULL,10),
 ('parts','قطع غيار السيارات','قطع الغيار','مباني 7 إلى 10 ومبنى 22','قطع غيار','shop',NULL,20),
 ('batteries-decor','بطاريات وزينة السيارات','بطاريات وزينة','على وحدات قطع الغيار — مباني 7 إلى 10','بطاريات','shop',NULL,30),
 ('tires','البناشر والإطارات','البناشر والإطارات','مباني 7 إلى 10','بناشر','service',NULL,40),
 ('car-wash','مغاسل السيارات','مغاسل السيارات','على وحدات البناشر — مباني 7 إلى 10','مغسلة','service',NULL,50),
 ('large-maintenance','مراكز صيانة السيارات الكبيرة','مراكز صيانة كبيرة','على وحدات المعارض — مبنى 22','مركز صيانة','workshop',NULL,60),
 ('shops','المحلات التجارية والمعارض','محلات تجارية','محلات ومعارض تجارية — مباني 12 و13 ومبنى 22','محل','shop',NULL,70),
 ('car-showrooms','معارض السيارات','معارض السيارات','معارض السيارات — مبنى 22','معرض سيارات','showroom',NULL,80),
 ('carpentry','ورش النجارة','النجارة','ورش النجارة والأخشاب','نجارة','workshop',NULL,90),
 ('smithing','ورش الألمنيوم والحدادة','الألمنيوم والحدادة','ورش الألمنيوم وأعمال الحدادة','حدادة','workshop',NULL,100),
 ('glass','ورش الزجاج','ورش الزجاج','مباني 14 إلى 19','زجاج','workshop',NULL,110),
 ('civil-defense','أنشطة الدفاع المدني','الدفاع المدني','مباني 14 إلى 19','دفاع مدني','service',NULL,120),
 ('warehouse-a','مستودعات متوسطة — مواد غير قابلة للاحتراق','مستودعات (أ)','سيراميك وبورسلان، أدوات صحية، مواد بناء (أسمنت، جبس، حجر، رخام)، حديد وألومنيوم، زجاج ومرايا، قطع غيار صناعية معدنية، محركات كهربائية، أثاث وخزائن معدنية، أوانٍ معدنية وخزفية — مباني 23 إلى 30 ومبنى 32','مستودع','warehouse','low',130),
 ('warehouse-b','مستودعات متوسطة — ملابس وأثاث وورق','مستودعات (ب)','ملابس ومنسوجات، أثاث خشبي ومنجّد، مفروشات وسجاد ومراتب، أخشاب، ورق وكرتون وكتب، مواد تغليف، حقائب وجلديات، إطارات مركبات، منتجات بلاستيكية — مباني 31 و33 و34 و35','مستودع','warehouse','medium',140)
ON CONFLICT (code) DO NOTHING;

-- ========== 2. Buildings / units extensions ==========
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.activities(id);
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS phase integer;
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.buildings(id);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.activities(id);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS area_m2 numeric(10,2);
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS publish_state text NOT NULL DEFAULT 'draft';
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='units_publish_state_check') THEN
    ALTER TABLE public.units ADD CONSTRAINT units_publish_state_check CHECK (publish_state IN ('draft','published','hidden'));
  END IF;
END $$;
COMMENT ON COLUMN public.units.area IS 'Legacy area kept in sync with area_m2 by trigger; area_m2 is canonical.';

CREATE TABLE IF NOT EXISTS public.building_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id),
  activity_id uuid NOT NULL REFERENCES public.activities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, activity_id)
);
GRANT SELECT ON public.building_activities TO authenticated;
GRANT ALL ON public.building_activities TO service_role;
ALTER TABLE public.building_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='building_activities' AND policyname='Admins and managers view building activities') THEN
    CREATE POLICY "Admins and managers view building activities" ON public.building_activities FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

-- Units restricted to specific activities (e.g. red tyre/wash corner units)
CREATE TABLE IF NOT EXISTS public.unit_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id),
  activity_id uuid NOT NULL REFERENCES public.activities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, activity_id)
);
GRANT SELECT ON public.unit_activities TO authenticated;
GRANT ALL ON public.unit_activities TO service_role;
ALTER TABLE public.unit_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='unit_activities' AND policyname='Admins and managers view unit activities') THEN
    CREATE POLICY "Admins and managers view unit activities" ON public.unit_activities FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.unit_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text,
  reason text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.unit_import_batches TO authenticated;
GRANT ALL ON public.unit_import_batches TO service_role;
ALTER TABLE public.unit_import_batches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='unit_import_batches' AND policyname='Admins and managers view import batches') THEN
    CREATE POLICY "Admins and managers view import batches" ON public.unit_import_batches FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
  END IF;
END $$;

-- ========== Backfill existing data ==========
UPDATE public.units u SET building_id = b.id FROM public.buildings b WHERE u.building_id IS NULL AND b.number = u.building_number;
UPDATE public.units SET area_m2 = area WHERE area_m2 IS NULL;
UPDATE public.units SET publish_state = 'published' WHERE publish_state = 'draft' AND created_at < now() AND NOT EXISTS (SELECT 1 FROM public.unit_import_batches);

UPDATE public.buildings b SET activity_id = a.id FROM public.activities a
WHERE b.activity_id IS NULL AND a.code = CASE
  WHEN b.number IN (1,2,3,4,5,6,11) THEN 'service'
  WHEN b.number IN (7,8,9,10) THEN 'parts'
  WHEN b.number IN (12,13,22) THEN 'shops'
  WHEN b.number IN (14,15,16) THEN 'carpentry'
  WHEN b.number IN (17,18,19) THEN 'smithing'
  WHEN b.number IN (23,24,25,26,27,28,29,30,32) THEN 'warehouse-a'
  WHEN b.number IN (31,33,34,35) THEN 'warehouse-b'
  ELSE NULL END;

INSERT INTO public.building_activities (building_id, activity_id)
SELECT b.id, a.id FROM public.buildings b JOIN public.activities a ON (
  (a.code='service' AND b.number IN (1,2,3,4,5,6,11)) OR
  (a.code='parts' AND b.number IN (7,8,9,10,22)) OR
  (a.code IN ('batteries-decor','tires','car-wash') AND b.number IN (7,8,9,10)) OR
  (a.code IN ('large-maintenance','car-showrooms') AND b.number = 22) OR
  (a.code='shops' AND b.number IN (12,13,22)) OR
  (a.code='carpentry' AND b.number IN (14,15,16)) OR
  (a.code='smithing' AND b.number IN (17,18,19)) OR
  (a.code IN ('glass','civil-defense') AND b.number IN (14,15,16,17,18,19)) OR
  (a.code='warehouse-a' AND b.number IN (23,24,25,26,27,28,29,30,32)) OR
  (a.code='warehouse-b' AND b.number IN (31,33,34,35)))
ON CONFLICT DO NOTHING;

INSERT INTO public.unit_activities (unit_id, activity_id)
SELECT u.id, a.id FROM public.units u JOIN public.activities a ON a.code IN ('tires','car-wash')
WHERE (u.building_number, u.unit_number) IN ((7,75),(7,85),(7,86),(7,96),(8,97),(8,107),(8,108),(8,118),(9,119),(9,128),(9,129),(9,138),(10,139),(10,148),(10,149),(10,158))
ON CONFLICT DO NOTHING;

UPDATE public.units u SET activity_id = a.id FROM public.activities a
WHERE u.activity_id IS NULL AND a.code = CASE
  WHEN EXISTS (SELECT 1 FROM public.unit_activities ua JOIN public.activities t ON t.id=ua.activity_id AND t.code='tires' WHERE ua.unit_id=u.id) THEN 'tires'
  WHEN u.building_number IN (21,22) AND u.unit_type = 'معرض سيارات' THEN 'car-showrooms'
  WHEN u.building_number IN (21,22) THEN 'shops'
  WHEN u.building_number IN (1,2,3,4,5,6,11) THEN 'service'
  WHEN u.building_number IN (7,8,9,10) THEN 'parts'
  WHEN u.building_number IN (12,13) THEN 'shops'
  WHEN u.building_number IN (14,15,16) THEN 'carpentry'
  WHEN u.building_number IN (17,18,19) THEN 'smithing'
  ELSE NULL END;

-- ========== 3. Integrity triggers ==========
CREATE OR REPLACE FUNCTION public.units_registry_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.building_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.building_number IS DISTINCT FROM OLD.building_number AND NEW.building_id IS NOT DISTINCT FROM OLD.building_id) THEN
    SELECT id INTO NEW.building_id FROM public.buildings WHERE number = NEW.building_number;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.area_m2 IS NULL THEN NEW.area_m2 := NEW.area; END IF;
    IF (NEW.area IS NULL OR NEW.area = 0) AND NEW.area_m2 IS NOT NULL THEN NEW.area := NEW.area_m2; END IF;
  ELSE
    IF NEW.area_m2 IS DISTINCT FROM OLD.area_m2 AND NEW.area IS NOT DISTINCT FROM OLD.area THEN NEW.area := coalesce(NEW.area_m2, 0);
    ELSIF NEW.area IS DISTINCT FROM OLD.area AND NEW.area_m2 IS NOT DISTINCT FROM OLD.area_m2 THEN NEW.area_m2 := NEW.area; END IF;
  END IF;
  -- Publish requirement: building, activity, unit type and area
  IF NEW.publish_state = 'published' AND (NEW.building_id IS NULL OR NEW.activity_id IS NULL OR coalesce(btrim(NEW.unit_type),'') = '' OR coalesce(NEW.area_m2,0) <= 0) THEN
    RAISE EXCEPTION 'لا يمكن نشر الوحدة % قبل استكمال المبنى والنشاط ونوع الوحدة والمساحة', NEW.unit_number USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS units_registry_sync_trg ON public.units;
CREATE TRIGGER units_registry_sync_trg BEFORE INSERT OR UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.units_registry_sync();

-- Non-admins can never book unpublished or test units
CREATE OR REPLACE FUNCTION public.booking_unit_publish_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u record;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  SELECT u.publish_state, u.is_test, coalesce(b.is_published, false) AS bpub INTO _u
  FROM public.units u LEFT JOIN public.buildings b ON b.id = u.building_id WHERE u.id = NEW.unit_id;
  IF _u.publish_state IS DISTINCT FROM 'published' OR _u.is_test OR NOT _u.bpub THEN
    RAISE EXCEPTION 'الوحدة % غير متاحة للحجز', NEW.unit_number USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS booking_unit_publish_guard_trg ON public.booking_units;
CREATE TRIGGER booking_unit_publish_guard_trg BEFORE INSERT ON public.booking_units FOR EACH ROW EXECUTE FUNCTION public.booking_unit_publish_guard();

-- ========== 4. Public views (no personal data) ==========
CREATE OR REPLACE VIEW public.public_activities AS
  SELECT code, name_ar, short_name, description, marker, unit_type, risk_class, sort_order
  FROM public.activities WHERE is_active ORDER BY sort_order;
CREATE OR REPLACE VIEW public.public_buildings AS
  SELECT b.number, b.type, b.phase, b.booking_enabled, b.expected_annual_revenue, a.code AS activity_code
  FROM public.buildings b LEFT JOIN public.activities a ON a.id = b.activity_id
  WHERE b.is_published;
CREATE OR REPLACE VIEW public.public_building_activities AS
  SELECT b.number AS building_number, a.code AS activity_code
  FROM public.building_activities ba JOIN public.buildings b ON b.id = ba.building_id JOIN public.activities a ON a.id = ba.activity_id
  WHERE b.is_published AND a.is_active
  UNION
  SELECT b.number, a.code FROM public.buildings b JOIN public.activities a ON a.id = b.activity_id WHERE b.is_published AND a.is_active;
CREATE OR REPLACE VIEW public.public_unit_activities AS
  SELECT u.building_number, u.unit_number, a.code AS activity_code
  FROM public.unit_activities ua JOIN public.units u ON u.id = ua.unit_id JOIN public.activities a ON a.id = ua.activity_id
  WHERE a.is_active AND u.publish_state = 'published' AND NOT u.is_test;
CREATE OR REPLACE VIEW public.public_units AS
  SELECT u.id, u.building_number, u.unit_number, u.unit_type, u.area_m2 AS area, u.activity, a.code AS activity_code, u.price, u.status
  FROM public.units u JOIN public.buildings b ON b.id = u.building_id LEFT JOIN public.activities a ON a.id = u.activity_id
  WHERE u.publish_state = 'published' AND NOT u.is_test AND b.is_published;
GRANT SELECT ON public.public_activities, public.public_buildings, public.public_building_activities, public.public_unit_activities, public.public_units TO anon, authenticated, service_role;

-- ========== 5. Admin functions ==========
CREATE OR REPLACE FUNCTION public.admin_upsert_activity(_id uuid, _code text, _name_ar text, _short_name text, _description text, _marker text, _unit_type text, _risk_class text, _notes text, _is_active boolean, _sort_order integer, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb; _rid uuid;
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM public._assert_reason(_reason);
  IF coalesce(btrim(_code),'') !~ '^[a-z0-9-]{2,40}$' THEN RAISE EXCEPTION 'كود النشاط لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة'; END IF;
  IF coalesce(btrim(_name_ar),'') = '' THEN RAISE EXCEPTION 'اسم النشاط مطلوب'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.activities(code,name_ar,short_name,description,marker,unit_type,risk_class,notes,is_active,sort_order)
    VALUES (btrim(_code),btrim(_name_ar),nullif(btrim(_short_name),''),nullif(btrim(_description),''),nullif(btrim(_marker),''),_unit_type,nullif(_risk_class,''),nullif(btrim(_notes),''),coalesce(_is_active,true),coalesce(_sort_order,100))
    RETURNING id INTO _rid;
    PERFORM public._safety_audit('INSERT','activities',_rid::text,NULL,(SELECT to_jsonb(a) FROM public.activities a WHERE id=_rid),_reason);
  ELSE
    SELECT to_jsonb(a) INTO _before FROM public.activities a WHERE id=_id;
    IF _before IS NULL THEN RAISE EXCEPTION 'النشاط غير موجود'; END IF;
    UPDATE public.activities SET code=btrim(_code), name_ar=btrim(_name_ar), short_name=nullif(btrim(_short_name),''), description=nullif(btrim(_description),''),
      marker=nullif(btrim(_marker),''), unit_type=_unit_type, risk_class=nullif(_risk_class,''), notes=nullif(btrim(_notes),''),
      is_active=coalesce(_is_active,true), sort_order=coalesce(_sort_order,100), updated_at=now() WHERE id=_id;
    _rid := _id;
    PERFORM public._safety_audit('UPDATE','activities',_rid::text,_before,(SELECT to_jsonb(a) FROM public.activities a WHERE id=_rid),_reason);
  END IF;
  RETURN _rid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_building_registry(_building_number integer, _primary_code text, _extra_codes text[], _phase integer, _is_published boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b record; _before jsonb; _primary uuid;
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM public._assert_reason(_reason);
  SELECT * INTO _b FROM public.buildings WHERE number=_building_number FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المبنى % غير موجود', _building_number; END IF;
  SELECT to_jsonb(_b) || jsonb_build_object('activities', (SELECT coalesce(jsonb_agg(a.code ORDER BY a.code),'[]') FROM public.building_activities ba JOIN public.activities a ON a.id=ba.activity_id WHERE ba.building_id=_b.id)) INTO _before;
  IF nullif(_primary_code,'') IS NOT NULL THEN
    SELECT id INTO _primary FROM public.activities WHERE code=_primary_code;
    IF _primary IS NULL THEN RAISE EXCEPTION 'النشاط % غير موجود', _primary_code; END IF;
  END IF;
  UPDATE public.buildings SET activity_id=_primary, phase=_phase, is_published=coalesce(_is_published, is_published), updated_at=now() WHERE id=_b.id;
  -- Links are additive-safe: removed links are preserved in archived_rows by the generic trigger when present
  INSERT INTO public.archived_rows(table_name,row_id,row_data,archived_by,archive_reason)
    SELECT 'building_activities', ba.id, to_jsonb(ba), auth.uid(), _reason FROM public.building_activities ba
    JOIN public.activities a ON a.id=ba.activity_id
    WHERE ba.building_id=_b.id AND NOT (a.code = ANY(coalesce(_extra_codes,'{}')) OR a.id = _primary);
  DELETE FROM public.building_activities ba USING public.activities a
    WHERE a.id=ba.activity_id AND ba.building_id=_b.id AND NOT (a.code = ANY(coalesce(_extra_codes,'{}')) OR a.id = _primary);
  INSERT INTO public.building_activities(building_id,activity_id)
    SELECT _b.id, a.id FROM public.activities a WHERE a.code = ANY(coalesce(_extra_codes,'{}')) OR a.id=_primary
    ON CONFLICT DO NOTHING;
  PERFORM public._safety_audit('UPDATE','buildings',_b.id::text,_before,
    (SELECT to_jsonb(b) FROM public.buildings b WHERE id=_b.id) || jsonb_build_object('activities',(SELECT coalesce(jsonb_agg(a.code ORDER BY a.code),'[]') FROM public.building_activities ba JOIN public.activities a ON a.id=ba.activity_id WHERE ba.building_id=_b.id)),
    _reason);
END $$;

CREATE OR REPLACE FUNCTION public.publish_unit(_unit_id uuid, _state text, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u record; _before jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM public._assert_reason(_reason);
  IF _state NOT IN ('draft','published','hidden') THEN RAISE EXCEPTION 'حالة نشر غير صحيحة'; END IF;
  SELECT * INTO _u FROM public.units WHERE id=_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
  IF _state = 'published' THEN
    IF _u.building_id IS NULL THEN RAISE EXCEPTION 'لا يمكن النشر: الوحدة بدون مبنى'; END IF;
    IF _u.activity_id IS NULL THEN RAISE EXCEPTION 'لا يمكن النشر: الوحدة بدون نشاط'; END IF;
    IF coalesce(btrim(_u.unit_type),'') = '' THEN RAISE EXCEPTION 'لا يمكن النشر: الوحدة بدون نوع'; END IF;
    IF coalesce(_u.area_m2,0) <= 0 THEN RAISE EXCEPTION 'لا يمكن النشر: الوحدة بدون مساحة'; END IF;
    IF _u.is_test THEN RAISE EXCEPTION 'لا يمكن نشر وحدة تجريبية'; END IF;
  END IF;
  _before := to_jsonb(_u);
  UPDATE public.units SET publish_state=_state, updated_at=now() WHERE id=_unit_id;
  PERFORM public._safety_audit('UPDATE','units',_unit_id::text,_before,(SELECT to_jsonb(x) FROM public.units x WHERE id=_unit_id),_reason);
  RETURN _state;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_unit_test(_unit_id uuid, _is_test boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM public._assert_reason(_reason);
  SELECT to_jsonb(u) INTO _before FROM public.units u WHERE id=_unit_id FOR UPDATE;
  IF _before IS NULL THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
  UPDATE public.units SET is_test=_is_test, publish_state = CASE WHEN _is_test THEN 'hidden' ELSE publish_state END, updated_at=now() WHERE id=_unit_id;
  PERFORM public._safety_audit('UPDATE','units',_unit_id::text,_before,(SELECT to_jsonb(x) FROM public.units x WHERE id=_unit_id),_reason);
END $$;

-- ========== 6. Unit import (dry-run + apply) ==========
CREATE OR REPLACE FUNCTION public.unit_import_preview(_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _r jsonb; _out jsonb := '[]'::jsonb; _i int := 0;
  _bn int; _un int; _type text; _act text; _area numeric; _price numeric;
  _b record; _a record; _u record; _other record;
  _conf text[]; _changes jsonb; _kind text; _seen text[] := '{}'; _key text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR auth.role()='service_role') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(_rows) <> 'array' THEN RAISE EXCEPTION 'صيغة الصفوف غير صحيحة'; END IF;
  IF jsonb_array_length(_rows) > 5000 THEN RAISE EXCEPTION 'الحد الأقصى 5000 صف في الملف الواحد'; END IF;
  FOR _r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _i := _i + 1; _conf := '{}'; _changes := '[]'::jsonb;
    _bn := nullif(regexp_replace(coalesce(_r->>'building_number',''),'[^0-9]','','g'),'')::int;
    _un := nullif(regexp_replace(coalesce(_r->>'unit_number',''),'[^0-9]','','g'),'')::int;
    _type := nullif(btrim(coalesce(_r->>'unit_type','')),'');
    _act := nullif(btrim(coalesce(_r->>'activity','')),'');
    _area := nullif(regexp_replace(coalesce(_r->>'area_m2',''),'[^0-9.]','','g'),'')::numeric;
    _price := nullif(regexp_replace(coalesce(_r->>'price',''),'[^0-9.]','','g'),'')::numeric;
    _b := NULL; _a := NULL; _u := NULL; _other := NULL;

    IF _bn IS NULL THEN _conf := _conf || 'رقم المبنى ناقص'; END IF;
    IF _un IS NULL THEN _conf := _conf || 'رقم الوحدة ناقص'; END IF;
    IF _area IS NULL OR _area <= 0 THEN _conf := _conf || 'المساحة ناقصة'; END IF;
    IF _bn IS NOT NULL THEN
      SELECT * INTO _b FROM public.buildings WHERE number=_bn;
      IF _b.id IS NULL THEN _conf := _conf || ('المبنى ' || _bn || ' غير موجود في السجل'); END IF;
    END IF;
    IF _act IS NOT NULL THEN
      SELECT * INTO _a FROM public.activities WHERE code=_act OR name_ar=_act OR short_name=_act LIMIT 1;
      IF _a.id IS NULL THEN _conf := _conf || ('النشاط "' || _act || '" غير موجود في السجل');
      ELSIF _b.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.building_activities WHERE building_id=_b.id AND activity_id=_a.id) AND _b.activity_id IS DISTINCT FROM _a.id THEN
        _conf := _conf || ('النشاط "' || _a.name_ar || '" مش من أنشطة المبنى ' || _bn);
      END IF;
    END IF;
    IF _bn IS NOT NULL AND _un IS NOT NULL THEN
      _key := _bn || '-' || _un;
      IF _key = ANY(_seen) THEN _conf := _conf || 'رقم الوحدة متكرر في الملف'; END IF;
      _seen := _seen || _key;
      SELECT * INTO _u FROM public.units WHERE building_number=_bn AND unit_number=_un;
      SELECT id, building_number INTO _other FROM public.units WHERE unit_number=_un AND building_number<>_bn LIMIT 1;
      IF _other.id IS NOT NULL AND _u.id IS NULL THEN _conf := _conf || ('الوحدة ' || _un || ' موجودة بالفعل في المبنى ' || _other.building_number); END IF;
    END IF;

    IF _u.id IS NOT NULL THEN
      IF _type IS NOT NULL AND _type IS DISTINCT FROM _u.unit_type THEN _changes := _changes || jsonb_build_object('field','unit_type','old',_u.unit_type,'new',_type); END IF;
      IF _a.id IS NOT NULL AND _a.id IS DISTINCT FROM _u.activity_id THEN _changes := _changes || jsonb_build_object('field','activity_id','old',(SELECT name_ar FROM public.activities WHERE id=_u.activity_id),'new',_a.name_ar,'new_id',_a.id); END IF;
      IF _area IS NOT NULL AND _area IS DISTINCT FROM _u.area_m2 THEN _changes := _changes || jsonb_build_object('field','area_m2','old',_u.area_m2,'new',_area); END IF;
      IF _price IS NOT NULL AND _price IS DISTINCT FROM _u.price THEN _changes := _changes || jsonb_build_object('field','price','old',_u.price,'new',_price); END IF;
    END IF;

    _kind := CASE WHEN array_length(_conf,1) > 0 THEN 'conflict' WHEN _u.id IS NULL THEN 'new' WHEN jsonb_array_length(_changes) > 0 THEN 'changed' ELSE 'unchanged' END;
    _out := _out || jsonb_build_object('row', coalesce((_r->>'row')::int, _i), 'kind', _kind, 'unit_id', _u.id,
      'building_number', _bn, 'unit_number', _un, 'unit_type', _type, 'activity_code', _a.code, 'activity_name', _a.name_ar,
      'area_m2', _area, 'price', _price, 'changes', _changes, 'conflicts', to_jsonb(_conf));
  END LOOP;
  RETURN _out;
END $$;

-- _rows: original rows of the approved selection; each may carry approved_fields (text[]) for changed units.
CREATE OR REPLACE FUNCTION public.unit_import_apply(_rows jsonb, _file_name text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _preview jsonb; _p jsonb; _src jsonb; _batch uuid; _new int := 0; _upd int := 0; _uid uuid; _before jsonb;
  _fields text[]; _ch jsonb;
BEGIN
  PERFORM public._assert_admin_writer();
  PERFORM public._assert_reason(_reason);
  _preview := public.unit_import_preview(_rows);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_preview) x WHERE x->>'kind'='conflict') THEN
    RAISE EXCEPTION 'فيه صفوف متعارضة ضمن المختار؛ صححها أو استبعدها قبل التطبيق';
  END IF;
  INSERT INTO public.unit_import_batches(file_name, reason, created_by) VALUES (_file_name, _reason, auth.uid()) RETURNING id INTO _batch;
  FOR _i IN 0 .. jsonb_array_length(_preview) - 1 LOOP
    _p := _preview->_i; _src := _rows->_i;
    IF _p->>'kind' = 'new' THEN
      INSERT INTO public.units(building_number, unit_number, unit_type, activity, activity_id, area, area_m2, price, status, publish_state)
      VALUES ((_p->>'building_number')::int, (_p->>'unit_number')::int, _p->>'unit_type', _p->>'activity_name',
              (SELECT id FROM public.activities WHERE code=_p->>'activity_code'),
              (_p->>'area_m2')::numeric, (_p->>'area_m2')::numeric, coalesce((_p->>'price')::numeric,0), 'available', 'draft')
      RETURNING id INTO _uid;
      PERFORM public._safety_audit('IMPORT_INSERT','units',_uid::text,NULL,(SELECT to_jsonb(u) FROM public.units u WHERE id=_uid),_reason || ' [batch ' || _batch || ']');
      _new := _new + 1;
    ELSIF _p->>'kind' = 'changed' THEN
      _uid := (_p->>'unit_id')::uuid;
      SELECT coalesce(array_agg(f), '{}') INTO _fields FROM jsonb_array_elements_text(coalesce(_src->'approved_fields','[]'::jsonb)) f;
      SELECT to_jsonb(u) INTO _before FROM public.units u WHERE id=_uid FOR UPDATE;
      FOR _ch IN SELECT * FROM jsonb_array_elements(_p->'changes') LOOP
        CONTINUE WHEN NOT (_ch->>'field' = ANY(_fields));
        IF _ch->>'field' = 'unit_type' THEN UPDATE public.units SET unit_type=_ch->>'new' WHERE id=_uid;
        ELSIF _ch->>'field' = 'activity_id' THEN UPDATE public.units SET activity_id=(_ch->>'new_id')::uuid, activity=_ch->>'new' WHERE id=_uid;
        ELSIF _ch->>'field' = 'area_m2' THEN UPDATE public.units SET area_m2=(_ch->>'new')::numeric, area=(_ch->>'new')::numeric WHERE id=_uid;
        ELSIF _ch->>'field' = 'price' THEN UPDATE public.units SET price=(_ch->>'new')::numeric WHERE id=_uid;
        END IF;
      END LOOP;
      IF array_length(_fields,1) > 0 THEN
        UPDATE public.units SET updated_at=now() WHERE id=_uid;
        PERFORM public._safety_audit('IMPORT_UPDATE','units',_uid::text,_before,(SELECT to_jsonb(u) FROM public.units u WHERE id=_uid),_reason || ' [batch ' || _batch || ']');
        _upd := _upd + 1;
      END IF;
    END IF;
  END LOOP;
  UPDATE public.unit_import_batches SET summary = jsonb_build_object('inserted',_new,'updated',_upd,'rows',jsonb_array_length(_rows)) WHERE id=_batch;
  RETURN jsonb_build_object('batch_id',_batch,'inserted',_new,'updated',_upd);
END $$;

-- ========== 7. Units needing completion ==========
CREATE OR REPLACE FUNCTION public.admin_units_needing_completion(_search text DEFAULT NULL, _issue text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _res jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
  WITH base AS (
    SELECT u.id, u.building_number, u.unit_number, u.unit_type, u.area_m2, u.status, u.publish_state, u.is_test,
           a.name_ar AS activity_name, a.unit_type AS activity_unit_type,
           array_remove(ARRAY[
             CASE WHEN u.building_id IS NULL THEN 'no_building' END,
             CASE WHEN u.activity_id IS NULL THEN 'no_activity' END,
             CASE WHEN coalesce(u.area_m2,0) <= 0 THEN 'no_area' END,
             CASE WHEN u.activity_id IS NOT NULL AND u.building_id IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM public.building_activities ba WHERE ba.building_id=u.building_id AND ba.activity_id=u.activity_id)
                   AND (SELECT activity_id FROM public.buildings WHERE id=u.building_id) IS DISTINCT FROM u.activity_id
                  THEN 'activity_not_in_building' END,
             CASE WHEN a.id IS NOT NULL AND ((u.unit_type='معرض سيارات' AND a.unit_type<>'showroom') OR (a.unit_type='showroom' AND coalesce(u.unit_type,'')<>'معرض سيارات'))
                  THEN 'type_conflict' END
           ], NULL) AS issues
    FROM public.units u LEFT JOIN public.activities a ON a.id=u.activity_id
  ), f AS (
    SELECT * FROM base WHERE cardinality(issues) > 0
      AND (_issue IS NULL OR _issue = ANY(issues))
      AND (_search IS NULL OR _search = '' OR unit_number::text = _search OR building_number::text = _search OR activity_name ILIKE '%'||_search||'%')
  )
  SELECT jsonb_build_object('total',(SELECT count(*) FROM f),'as_of',now(),
    'rows',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM f ORDER BY building_number NULLS FIRST, unit_number LIMIT least(greatest(_limit,1),5000) OFFSET greatest(_offset,0)) x),'[]'))
  INTO _res;
  RETURN _res;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_upsert_activity(uuid,text,text,text,text,text,text,text,text,boolean,integer,text), public.admin_set_building_registry(integer,text,text[],integer,boolean,text), public.publish_unit(uuid,text,text), public.admin_set_unit_test(uuid,boolean,text), public.unit_import_preview(jsonb), public.unit_import_apply(jsonb,text,text), public.admin_units_needing_completion(text,text,integer,integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_upsert_activity(uuid,text,text,text,text,text,text,text,text,boolean,integer,text), public.admin_set_building_registry(integer,text,text[],integer,boolean,text), public.publish_unit(uuid,text,text), public.admin_set_unit_test(uuid,boolean,text), public.unit_import_preview(jsonb), public.unit_import_apply(jsonb,text,text), public.admin_units_needing_completion(text,text,integer,integer) TO authenticated, service_role;

-- Verification
SELECT (SELECT count(*) FROM public.activities) AS activities,
       (SELECT count(*) FROM public.units WHERE building_id IS NULL) AS units_without_building,
       (SELECT count(*) FROM public.units WHERE publish_state='published') AS published_units,
       (SELECT count(*) FROM public.units) AS all_units,
       (SELECT count(*) FROM public.unit_activities) AS restricted_unit_links;