-- جدول الحجوزات
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_full_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  business_name TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled
  total_area NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  units_count INTEGER NOT NULL DEFAULT 0,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);

-- جدول وحدات الحجز
CREATE TABLE public.booking_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL,
  building_number INTEGER NOT NULL,
  unit_number INTEGER NOT NULL,
  unit_type TEXT,
  area NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  activity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_units_booking_id ON public.booking_units(booking_id);
CREATE INDEX idx_booking_units_unit_id ON public.booking_units(unit_id);

-- RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own booking units" ON public.booking_units
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

CREATE POLICY "Admins view all booking units" ON public.booking_units
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage booking units" ON public.booking_units
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- دالة آمنة لإنشاء حجز كامل
CREATE OR REPLACE FUNCTION public.create_booking(
  _customer_full_name TEXT,
  _customer_phone TEXT,
  _customer_email TEXT,
  _business_name TEXT,
  _notes TEXT,
  _unit_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user UUID := auth.uid();
  _booking_id UUID;
  _total_area NUMERIC := 0;
  _total_price NUMERIC := 0;
  _count INTEGER := 0;
  _u RECORD;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء حجز';
  END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'لا توجد وحدات في الحجز';
  END IF;

  -- التحقق من توفّر كل الوحدات
  FOR _u IN
    SELECT id, building_number, unit_number, unit_type, area, price, activity, status
    FROM public.units
    WHERE id = ANY(_unit_ids)
    FOR UPDATE
  LOOP
    IF _u.status <> 'available' THEN
      RAISE EXCEPTION 'الوحدة % في المبنى % لم تعد متاحة', _u.unit_number, _u.building_number;
    END IF;
    _total_area := _total_area + COALESCE(_u.area, 0);
    _total_price := _total_price + COALESCE(_u.price, 0);
    _count := _count + 1;
  END LOOP;

  IF _count <> array_length(_unit_ids, 1) THEN
    RAISE EXCEPTION 'بعض الوحدات غير موجودة';
  END IF;

  -- إنشاء الحجز
  INSERT INTO public.bookings (
    user_id, customer_full_name, customer_phone, customer_email,
    business_name, notes, total_area, total_price, units_count
  ) VALUES (
    _user, _customer_full_name, _customer_phone, _customer_email,
    _business_name, _notes, _total_area, _total_price, _count
  ) RETURNING id INTO _booking_id;

  -- إضافة الوحدات وتحديث حالتها
  FOR _u IN
    SELECT id, building_number, unit_number, unit_type, area, price, activity
    FROM public.units
    WHERE id = ANY(_unit_ids)
  LOOP
    INSERT INTO public.booking_units (
      booking_id, unit_id, building_number, unit_number,
      unit_type, area, price, activity
    ) VALUES (
      _booking_id, _u.id, _u.building_number, _u.unit_number,
      _u.unit_type, _u.area, _u.price, _u.activity
    );

    UPDATE public.units SET status = 'reserved', updated_at = now()
    WHERE id = _u.id;
  END LOOP;

  RETURN _booking_id;
END;
$$;

-- دالة لتأكيد إرسال الواتساب
CREATE OR REPLACE FUNCTION public.mark_booking_whatsapp_sent(_booking_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bookings
  SET whatsapp_sent = true, updated_at = now()
  WHERE id = _booking_id AND user_id = auth.uid();
END;
$$;