CREATE OR REPLACE FUNCTION public.extend_booking_expiry(_booking_id uuid, _hours integer)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_expiry timestamptz;
  _current_status text;
  _current_expiry timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _hours IS NULL OR _hours = 0 THEN
    RAISE EXCEPTION 'عدد الساعات غير صالح';
  END IF;

  SELECT status, expires_at INTO _current_status, _current_expiry
  FROM public.bookings WHERE id = _booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- نمدد من الآن لو منتهي، ومن expires_at الحالي لو لسه شغّال
  IF _current_expiry < now() THEN
    _new_expiry := now() + make_interval(hours => _hours);
  ELSE
    _new_expiry := _current_expiry + make_interval(hours => _hours);
  END IF;

  UPDATE public.bookings
  SET expires_at = _new_expiry,
      status = CASE WHEN status = 'expired' THEN 'pending' ELSE status END,
      updated_at = now()
  WHERE id = _booking_id;

  -- لو الحجز كان expired نرجّع الوحدات reserved (لو لسه available)
  IF _current_status = 'expired' THEN
    UPDATE public.units
    SET status = 'reserved', updated_at = now()
    WHERE id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id)
      AND status = 'available';
  END IF;

  RETURN _new_expiry;
END;
$$;