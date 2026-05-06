
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS offer_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.offer_number_seq_2026 START WITH 52 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_offer_number(_booking_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year int := EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Riyadh')::int;
  _seq_name text := 'offer_number_seq_' || _year;
  _n bigint;
  _formatted text;
  _existing text;
BEGIN
  IF _booking_id IS NOT NULL THEN
    SELECT offer_number INTO _existing FROM public.bookings WHERE id = _booking_id;
    IF _existing IS NOT NULL AND _existing <> '' THEN
      RETURN _existing;
    END IF;
  END IF;

  BEGIN
    EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _n;
  EXCEPTION WHEN undefined_table THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START WITH 1 INCREMENT BY 1', _seq_name);
    EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _n;
  END;

  _formatted := _year::text || lpad(_n::text, 6, '0');

  IF _booking_id IS NOT NULL THEN
    UPDATE public.bookings SET offer_number = _formatted WHERE id = _booking_id AND (offer_number IS NULL OR offer_number = '');
  END IF;

  RETURN _formatted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_offer_number(uuid) TO authenticated, anon, service_role;
