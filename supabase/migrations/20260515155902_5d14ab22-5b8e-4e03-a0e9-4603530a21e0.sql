
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.bookings SET status = 'cancelled', updated_at = now() WHERE id = _booking_id;

  UPDATE public.units u
    SET status = 'available', updated_at = now()
   WHERE u.id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = _booking_id)
     AND u.status = 'reserved'
     AND NOT EXISTS (
       SELECT 1 FROM public.booking_units bu2
       JOIN public.bookings b2 ON b2.id = bu2.booking_id
       WHERE bu2.unit_id = u.id
         AND b2.id <> _booking_id
         AND b2.status IN ('pending','confirmed')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.tenants t
       WHERE t.unit_id = u.id
         AND (t.booking_id IS NULL OR t.booking_id <> _booking_id)
     );
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _ids
  FROM public.bookings
  WHERE status = 'pending' AND expires_at < now();

  IF _ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.bookings
    SET status = 'expired', updated_at = now()
    WHERE id = ANY(_ids);

  UPDATE public.units u
    SET status = 'available', updated_at = now()
    WHERE u.status = 'reserved'
      AND u.id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = ANY(_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.booking_units bu2
        JOIN public.bookings b2 ON b2.id = bu2.booking_id
        WHERE bu2.unit_id = u.id
          AND NOT (b2.id = ANY(_ids))
          AND b2.status IN ('pending','confirmed')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.unit_id = u.id
          AND (t.booking_id IS NULL OR NOT (t.booking_id = ANY(_ids)))
      );

  RETURN array_length(_ids, 1);
END;
$function$;
