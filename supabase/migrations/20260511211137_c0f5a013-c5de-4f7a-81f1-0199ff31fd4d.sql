ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cr_number text;
ALTER TABLE public.tenant_accounts ADD COLUMN IF NOT EXISTS cr_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cr_number text;

CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text, _customer_phone text, _customer_email text, _business_name text, _notes text, _unit_ids uuid[], _cr_number text DEFAULT NULL)
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

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity, status FROM public.units WHERE id = ANY(_unit_ids) FOR UPDATE LOOP
    IF _u.status <> 'available' THEN RAISE EXCEPTION 'الوحدة % في المبنى % لم تعد متاحة', _u.unit_number, _u.building_number; END IF;
    _total_area := _total_area + COALESCE(_u.area, 0);
    _total_price := _total_price + COALESCE(_u.price, 0);
    _count := _count + 1;
  END LOOP;

  IF _count <> array_length(_unit_ids, 1) THEN RAISE EXCEPTION 'بعض الوحدات غير موجودة'; END IF;

  INSERT INTO public.bookings (user_id, customer_full_name, customer_phone, customer_email, business_name, notes, total_area, total_price, units_count, cr_number)
  VALUES (_user, _customer_full_name, _customer_phone, _customer_email, _business_name, _notes, _total_area, _total_price, _count, _cr_number)
  RETURNING id INTO _booking_id;

  FOR _u IN SELECT id, building_number, unit_number, unit_type, area, price, activity FROM public.units WHERE id = ANY(_unit_ids) LOOP
    INSERT INTO public.booking_units (booking_id, unit_id, building_number, unit_number, unit_type, area, price, activity)
    VALUES (_booking_id, _u.id, _u.building_number, _u.unit_number, _u.unit_type, _u.area, _u.price, _u.activity);
    UPDATE public.units SET status = 'reserved', updated_at = now() WHERE id = _u.id;
  END LOOP;

  RETURN _booking_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _b RECORD; _u RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_tenant_accounts();
CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
 RETURNS TABLE(id uuid, user_id uuid, full_name text, phone text, email text, business_name text, activity_type text, notes text, total_price numeric, created_at timestamp with time zone, units_count bigint, unpaid_invoices bigint, unpaid_total numeric, has_login boolean, cr_number text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name, ta.activity_type, ta.notes, ta.total_price, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units tau WHERE tau.tenant_account_id = ta.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    (ta.user_id IS NOT NULL), ta.cr_number
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.full_name;
$function$;