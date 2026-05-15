
-- Harden create_booking to reject units with existing tenant records or other active bookings
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text, _customer_phone text, _customer_email text, _business_name text, _notes text, _unit_ids uuid[], _cr_number text DEFAULT NULL::text, _payment_plan text DEFAULT 'full'::text)
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
  _has_tenant BOOLEAN;
  _has_active_booking BOOLEAN;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء حجز'; END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN RAISE EXCEPTION 'لا توجد وحدات في الحجز'; END IF;
  IF _payment_plan NOT IN ('full','70','50') THEN _payment_plan := 'full'; END IF;

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity, status FROM public.units WHERE id = ANY(_unit_ids) FOR UPDATE LOOP
    IF _u.status <> 'available' THEN
      RAISE EXCEPTION 'الوحدة % في المبنى % لم تعد متاحة', _u.unit_number, _u.building_number;
    END IF;

    -- Belt & suspenders: reject if there is a tenant record (admin reservation or rented)
    SELECT EXISTS(SELECT 1 FROM public.tenants t WHERE t.unit_id = _u.id) INTO _has_tenant;
    IF _has_tenant THEN
      -- Self-heal: mark unit reserved so next attempt also blocks at status check
      UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
      RAISE EXCEPTION 'الوحدة % في المبنى % محجوزة من قبل الإدارة', _u.unit_number, _u.building_number;
    END IF;

    -- Reject if any other pending/confirmed booking still references this unit
    SELECT EXISTS(
      SELECT 1 FROM public.booking_units bu
      JOIN public.bookings b ON b.id = bu.booking_id
      WHERE bu.unit_id = _u.id AND b.status IN ('pending','confirmed')
    ) INTO _has_active_booking;
    IF _has_active_booking THEN
      UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
      RAISE EXCEPTION 'الوحدة % في المبنى % محجوزة حالياً', _u.unit_number, _u.building_number;
    END IF;

    _total_area := _total_area + COALESCE(_u.area, 0);
    _total_price := _total_price + COALESCE(_u.price, 0);
    _count := _count + 1;
  END LOOP;

  IF _count <> array_length(_unit_ids, 1) THEN RAISE EXCEPTION 'بعض الوحدات غير موجودة'; END IF;

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

-- Clean up the rogue booking on unit 113 (building 8): cancel it and remove unit from booking_units,
-- restore the unit to reserved (it has an admin tenant record).
DO $$
DECLARE
  _bad_booking uuid := 'e2e3b1a9-f56b-448f-a348-63fc193375f4';
  _bad_unit uuid := '9e944276-a6f1-485b-b783-16c23229f2f0';
  _other_units int;
BEGIN
  -- Remove the conflicting unit from this booking
  DELETE FROM public.booking_units WHERE booking_id = _bad_booking AND unit_id = _bad_unit;

  -- Recount remaining units; if none left cancel whole booking, otherwise recompute totals
  SELECT COUNT(*) INTO _other_units FROM public.booking_units WHERE booking_id = _bad_booking;

  IF _other_units = 0 THEN
    UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = _bad_booking;
  ELSE
    UPDATE public.bookings b SET
      units_count = _other_units,
      total_area = COALESCE((SELECT SUM(area) FROM public.booking_units WHERE booking_id = _bad_booking), 0),
      total_price = COALESCE((SELECT SUM(price) FROM public.booking_units WHERE booking_id = _bad_booking), 0),
      updated_at = now()
    WHERE id = _bad_booking;
  END IF;

  -- Restore the unit as reserved (admin tenant record still exists)
  UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _bad_unit;
END $$;
