ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS api_cors_allowlist text[] NOT NULL DEFAULT ARRAY[
  'https://ejar.mnicity.com','https://mnicity.com','https://www.mnicity.com',
  'https://mnicejar.com','https://www.mnicejar.com',
  'https://makka-lease-hub.lovable.app',
  'https://id-preview--d1d73129-051c-4235-a4f0-a74452fc2178.lovable.app'
]::text[];

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS id_type text;
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS id_type text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_id_type_check') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_id_type_check
      CHECK (id_type IS NULL OR id_type IN ('commercial_registration','national_id','iqama')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_profiles_id_type_check') THEN
    ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_id_type_check
      CHECK (id_type IS NULL OR id_type IN ('commercial_registration','national_id','iqama')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_identity(_id_type text, _number text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _id_type
    WHEN 'commercial_registration' THEN coalesce(_number,'') ~ '^7[0-9]{9}$'
    WHEN 'national_id' THEN coalesce(_number,'') ~ '^1[0-9]{9}$'
    WHEN 'iqama' THEN coalesce(_number,'') ~ '^2[0-9]{9}$'
    ELSE false END
$$;
GRANT EXECUTE ON FUNCTION public.validate_identity(text, text) TO anon, authenticated, service_role;

-- New overload: requires an explicit identity type and validates the number.
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text, _customer_phone text, _customer_email text, _business_name text, _notes text, _unit_ids uuid[], _cr_number text, _payment_plan text, _id_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _user UUID := auth.uid();
  _booking_id UUID;
  _total_area NUMERIC := 0;
  _total_price NUMERIC := 0;
  _count INTEGER := 0;
  _u RECORD;
BEGIN
  IF public.has_role(auth.uid(), 'manager') AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'صلاحية المدير للعرض فقط' USING ERRCODE = '42501';
  END IF;
  IF _user IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء حجز'; END IF;
  _cr_number := btrim(coalesce(_cr_number, ''));
  IF _id_type IS NULL OR _id_type NOT IN ('commercial_registration','national_id','iqama') THEN
    RAISE EXCEPTION 'يرجى اختيار نوع الهوية' USING ERRCODE = '22023';
  END IF;
  IF NOT public.validate_identity(_id_type, _cr_number) THEN
    RAISE EXCEPTION '%', CASE _id_type
      WHEN 'commercial_registration' THEN 'الرقم الموحد للسجل التجاري يجب أن يكون 10 أرقام ويبدأ بـ 7'
      WHEN 'national_id' THEN 'رقم الهوية الوطنية يجب أن يكون 10 أرقام ويبدأ بـ 1'
      ELSE 'رقم الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 2' END USING ERRCODE = '22023';
  END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN RAISE EXCEPTION 'لا توجد وحدات في الحجز'; END IF;
  IF _payment_plan NOT IN ('full','70','50') THEN _payment_plan := 'full'; END IF;

  FOR _u IN SELECT id, building_number, unit_number, area, price, status FROM public.units WHERE id = ANY(_unit_ids) FOR UPDATE LOOP
    IF EXISTS (SELECT 1 FROM public.buildings b WHERE b.number = _u.building_number AND b.booking_enabled IS NOT TRUE) THEN
      RAISE EXCEPTION 'المبنى % مغلق عن الحجز حاليا', _u.building_number;
    END IF;
    IF _u.status <> 'available' THEN
      RAISE EXCEPTION 'الوحدة % في المبنى % لم تعد متاحة', _u.unit_number, _u.building_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.unit_id = _u.id) THEN
      UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
      RAISE EXCEPTION 'الوحدة % في المبنى % محجوزة من قبل الإدارة', _u.unit_number, _u.building_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.booking_units bu JOIN public.bookings b ON b.id = bu.booking_id
               WHERE bu.unit_id = _u.id AND b.status IN ('pending','confirmed')) THEN
      UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
      RAISE EXCEPTION 'الوحدة % في المبنى % محجوزة حالياً', _u.unit_number, _u.building_number;
    END IF;
    _total_area := _total_area + COALESCE(_u.area, 0);
    _total_price := _total_price + COALESCE(_u.price, 0);
    _count := _count + 1;
  END LOOP;

  IF _count <> array_length(_unit_ids, 1) THEN RAISE EXCEPTION 'بعض الوحدات غير موجودة'; END IF;

  INSERT INTO public.bookings (user_id, customer_full_name, customer_phone, customer_email, business_name, notes, total_area, total_price, units_count, cr_number, payment_plan, id_type)
  VALUES (_user, _customer_full_name, _customer_phone, _customer_email, _business_name, _notes, _total_area, _total_price, _count, _cr_number, _payment_plan, _id_type)
  RETURNING id INTO _booking_id;

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity FROM public.units WHERE id = ANY(_unit_ids) LOOP
    INSERT INTO public.booking_units (booking_id, unit_id, building_number, unit_number, unit_type, area, price, activity)
    VALUES (_booking_id, _u.id, _u.building_number, _u.unit_number, _u.unit_type, _u.area, _u.price, _u.activity);
    UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
  END LOOP;

  RETURN _booking_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_booking(text,text,text,text,text,uuid[],text,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_booking(text,text,text,text,text,uuid[],text,text,text) TO authenticated, service_role;

-- Old 8-arg signature (cached clients): infer the identity type from the first digit and validate.
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text, _customer_phone text, _customer_email text, _business_name text, _notes text, _unit_ids uuid[], _cr_number text DEFAULT NULL::text, _payment_plan text DEFAULT 'full'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN public.create_booking(_customer_full_name, _customer_phone, _customer_email, _business_name, _notes, _unit_ids,
    _cr_number, _payment_plan,
    CASE left(btrim(coalesce(_cr_number,'')), 1)
      WHEN '7' THEN 'commercial_registration' WHEN '1' THEN 'national_id' WHEN '2' THEN 'iqama' ELSE NULL END);
END;
$function$;

-- Verification
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='app_settings' AND column_name='api_cors_allowlist') AS has_cors_col,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='id_type' AND table_name IN ('bookings','customer_profiles')) AS id_type_cols,
  public.validate_identity('commercial_registration','7012345678') AS cr_ok,
  public.validate_identity('national_id','2012345678') AS nid_wrong_should_be_false,
  (SELECT count(*) FROM pg_proc WHERE proname='create_booking') AS create_booking_overloads;