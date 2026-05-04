-- إضافة عمود لتخزين رابط صورة العرض
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS offer_image_url text;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS offer_image_url text;

CREATE INDEX IF NOT EXISTS idx_tenants_booking_id ON public.tenants(booking_id);

-- دالة تأكيد الحجز: تحوّل الوحدات إلى rented وتنشئ tenants
CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _b RECORD;
  _u RECORD;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  UPDATE public.bookings SET status = 'confirmed', updated_at = now() WHERE id = _booking_id;

  FOR _u IN
    SELECT bu.unit_id, bu.activity, bu.building_number, bu.unit_number
    FROM public.booking_units bu
    WHERE bu.booking_id = _booking_id
  LOOP
    UPDATE public.units
      SET status = 'rented', updated_at = now()
      WHERE id = _u.unit_id;

    -- لا نكرّر إن كان tenant بنفس الوحدة موجود لنفس الحجز
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants
      WHERE unit_id = _u.unit_id AND booking_id = _booking_id
    ) THEN
      INSERT INTO public.tenants (
        unit_id, tenant_name, business_name, activity_type, phone, notes,
        start_date, booking_id, offer_image_url
      ) VALUES (
        _u.unit_id,
        _b.customer_full_name,
        _b.business_name,
        _u.activity,
        _b.customer_phone,
        _b.notes,
        CURRENT_DATE,
        _booking_id,
        _b.offer_image_url
      );
    END IF;
  END LOOP;
END;
$$;

-- دالة لإلغاء الحجز: ترجع الوحدات إلى متاح
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = _booking_id;

  UPDATE public.units SET status = 'available', updated_at = now()
   WHERE id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id)
     AND status = 'reserved';
END;
$$;