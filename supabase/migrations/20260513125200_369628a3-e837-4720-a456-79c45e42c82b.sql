ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.tenant_accounts ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid, _paid_amount numeric DEFAULT 0)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _b RECORD; _u RECORD; _ta_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _b FROM public.bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  UPDATE public.bookings
    SET status = 'confirmed', paid_amount = COALESCE(_paid_amount, 0), updated_at = now()
    WHERE id = _booking_id;
  FOR _u IN SELECT bu.unit_id, bu.activity, bu.building_number, bu.unit_number FROM public.booking_units bu WHERE bu.booking_id = _booking_id LOOP
    UPDATE public.units SET status = 'rented', updated_at = now() WHERE id = _u.unit_id;
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE unit_id = _u.unit_id AND booking_id = _booking_id) THEN
      INSERT INTO public.tenants (unit_id, tenant_name, business_name, activity_type, phone, notes, start_date, booking_id, offer_image_url, cr_number)
      VALUES (_u.unit_id, _b.customer_full_name, _b.business_name, _u.activity, _b.customer_phone, _b.notes, CURRENT_DATE, _booking_id, _b.offer_image_url, _b.cr_number);
    END IF;
  END LOOP;
  SELECT id INTO _ta_id FROM public.tenant_accounts
    WHERE btrim(full_name) = btrim(_b.customer_full_name)
      AND COALESCE(NULLIF(btrim(COALESCE(phone,'')), ''), '') = COALESCE(NULLIF(btrim(COALESCE(_b.customer_phone,'')), ''), '')
    LIMIT 1;
  IF _ta_id IS NOT NULL AND COALESCE(_paid_amount, 0) > 0 THEN
    UPDATE public.tenant_accounts
      SET paid_amount = COALESCE(paid_amount,0) + COALESCE(_paid_amount,0), updated_at = now()
      WHERE id = _ta_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_booking_paid_amount(_booking_id uuid, _paid_amount numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _paid_amount IS NULL OR _paid_amount < 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  UPDATE public.bookings SET paid_amount = _paid_amount, updated_at = now() WHERE id = _booking_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tenant_account_paid_amount(_tenant_account_id uuid, _paid_amount numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _paid_amount IS NULL OR _paid_amount < 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  UPDATE public.tenant_accounts SET paid_amount = _paid_amount, updated_at = now() WHERE id = _tenant_account_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_tenant_accounts();
CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
 RETURNS TABLE(id uuid, user_id uuid, full_name text, phone text, email text, business_name text, activity_type text, notes text, total_price numeric, paid_amount numeric, created_at timestamp with time zone, units_count bigint, unpaid_invoices bigint, unpaid_total numeric, has_login boolean, cr_number text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name, ta.activity_type, ta.notes, ta.total_price, ta.paid_amount, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units tau WHERE tau.tenant_account_id = ta.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    (ta.user_id IS NOT NULL), ta.cr_number
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.full_name;
$function$;