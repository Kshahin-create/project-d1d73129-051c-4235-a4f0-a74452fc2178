
-- Add payment plan to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_plan text NOT NULL DEFAULT 'full'
  CHECK (payment_plan IN ('full','70','50'));

-- Recreate create_booking with _payment_plan parameter
CREATE OR REPLACE FUNCTION public.create_booking(
  _customer_full_name text,
  _customer_phone text,
  _customer_email text,
  _business_name text,
  _notes text,
  _unit_ids uuid[],
  _cr_number text DEFAULT NULL::text,
  _payment_plan text DEFAULT 'full'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user UUID := auth.uid();
  _booking_id UUID;
  _total_area NUMERIC := 0;
  _total_price NUMERIC := 0;
  _count INTEGER := 0;
  _u RECORD;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء حجز'; END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN RAISE EXCEPTION 'لا توجد وحدات في الحجز'; END IF;
  IF _payment_plan NOT IN ('full','70','50') THEN _payment_plan := 'full'; END IF;

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity, status FROM public.units WHERE id = ANY(_unit_ids) FOR UPDATE LOOP
    IF _u.status <> 'available' THEN RAISE EXCEPTION 'الوحدة % في المبنى % لم تعد متاحة', _u.unit_number, _u.building_number; END IF;
    _total_area := _total_area + COALESCE(_u.area, 0);
    _total_price := _total_price + COALESCE(_u.price, 0);
    _count := _count + 1;
  END LOOP;

  IF _count <> array_length(_unit_ids, 1) THEN RAISE EXCEPTION 'بعض الوحدات غير موجودة'; END IF;

  -- خطة 50% فقط إذا تجاوز الإيجار 150,000
  IF _payment_plan = '50' AND _total_price < 150000 THEN
    RAISE EXCEPTION 'نظام السداد 50%% متاح فقط عندما تتجاوز قيمة الإيجار السنوي 150,000 ريال';
  END IF;

  INSERT INTO public.bookings (user_id, customer_full_name, customer_phone, customer_email, business_name, notes, total_area, total_price, units_count, cr_number, payment_plan)
  VALUES (_user, _customer_full_name, _customer_phone, _customer_email, _business_name, _notes, _total_area, _total_price, _count, _cr_number, _payment_plan)
  RETURNING id INTO _booking_id;

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity FROM public.units WHERE id = ANY(_unit_ids) LOOP
    INSERT INTO public.booking_units (booking_id, unit_id, building_number, unit_number, unit_type, area, price, activity)
    VALUES (_booking_id, _u.id, _u.building_number, _u.unit_number, _u.unit_type, _u.area, _u.price, _u.activity);
    UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
  END LOOP;

  RETURN _booking_id;
END;
$function$;
