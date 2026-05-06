
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours');

-- Backfill existing pending rows: set expiry 48h after created_at
UPDATE public.bookings
  SET expires_at = created_at + interval '48 hours'
  WHERE expires_at IS NULL OR expires_at = created_at;

CREATE OR REPLACE FUNCTION public.expire_pending_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ids uuid[];
  _count integer := 0;
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

  UPDATE public.units
    SET status = 'available', updated_at = now()
    WHERE status = 'reserved'
      AND id IN (SELECT unit_id FROM public.booking_units WHERE booking_id = ANY(_ids));

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN array_length(_ids, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_pending_bookings() TO authenticated, anon;
