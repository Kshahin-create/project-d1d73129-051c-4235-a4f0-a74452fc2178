
ALTER TABLE public.invoices
  ALTER COLUMN tenant_account_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_business text,
  ADD COLUMN IF NOT EXISTS cr_number text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_idx ON public.invoices(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_booking_id_idx ON public.invoices(booking_id);

-- RLS: allow user to view invoices linked to own booking
DROP POLICY IF EXISTS "Users view own booking invoices" ON public.invoices;
CREATE POLICY "Users view own booking invoices" ON public.invoices
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = invoices.booking_id AND b.user_id = auth.uid()));

-- Invoice number generator
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := EXTRACT(YEAR FROM now() AT TIME ZONE 'Asia/Riyadh')::int;
  _seq_name text := 'invoice_number_seq_' || _year;
  _n bigint;
BEGIN
  BEGIN
    EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _n;
  EXCEPTION WHEN undefined_table THEN
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.%I START WITH 1 INCREMENT BY 1', _seq_name);
    EXECUTE format('SELECT nextval(%L)', 'public.' || _seq_name) INTO _n;
  END;
  RETURN 'INV-' || _year::text || '-' || lpad(_n::text, 5, '0');
END; $$;

-- Record a payment and create invoice
CREATE OR REPLACE FUNCTION public.record_payment(
  _booking_id uuid DEFAULT NULL,
  _tenant_account_id uuid DEFAULT NULL,
  _amount numeric DEFAULT 0,
  _method text DEFAULT 'cash',
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invoice_id uuid;
  _b RECORD;
  _ta RECORD;
  _ta_id uuid := _tenant_account_id;
  _name text; _phone text; _bus text; _cr text;
  _unit_id uuid;
  _inv_num text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;
  IF _booking_id IS NULL AND _tenant_account_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد حجز أو حساب مستأجر';
  END IF;

  IF _booking_id IS NOT NULL THEN
    SELECT * INTO _b FROM public.bookings WHERE id = _booking_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
    UPDATE public.bookings SET paid_amount = COALESCE(paid_amount,0) + _amount, updated_at = now() WHERE id = _booking_id;
    _name := _b.customer_full_name; _phone := _b.customer_phone; _bus := _b.business_name; _cr := _b.cr_number;
    SELECT unit_id INTO _unit_id FROM public.booking_units WHERE booking_id = _booking_id LIMIT 1;
    IF _ta_id IS NULL THEN
      SELECT id INTO _ta_id FROM public.tenant_accounts
        WHERE btrim(full_name) = btrim(_b.customer_full_name)
          AND COALESCE(NULLIF(btrim(COALESCE(phone,'')),''),'') = COALESCE(NULLIF(btrim(COALESCE(_b.customer_phone,'')),''),'')
        LIMIT 1;
    END IF;
  END IF;

  IF _ta_id IS NOT NULL THEN
    SELECT * INTO _ta FROM public.tenant_accounts WHERE id = _ta_id;
    IF FOUND THEN
      UPDATE public.tenant_accounts SET paid_amount = COALESCE(paid_amount,0) + _amount, updated_at = now() WHERE id = _ta_id;
      IF _name IS NULL THEN _name := _ta.full_name; END IF;
      IF _phone IS NULL THEN _phone := _ta.phone; END IF;
      IF _bus IS NULL THEN _bus := _ta.business_name; END IF;
      IF _cr IS NULL THEN _cr := _ta.cr_number; END IF;
    END IF;
  END IF;

  _inv_num := public.next_invoice_number();

  INSERT INTO public.invoices (
    tenant_account_id, booking_id, unit_id, amount, paid_amount, paid, paid_at,
    notes, created_by, invoice_number, payment_method,
    customer_name, customer_phone, customer_business, cr_number
  ) VALUES (
    _ta_id, _booking_id, _unit_id, _amount, _amount, true, now(),
    _notes, auth.uid(), _inv_num, COALESCE(_method,'cash'),
    _name, _phone, _bus, _cr
  ) RETURNING id INTO _invoice_id;

  RETURN _invoice_id;
END; $$;

-- Public-view function for tenant invoice page (own only)
CREATE OR REPLACE FUNCTION public.get_invoice_for_view(_invoice_id uuid)
RETURNS TABLE(
  id uuid, invoice_number text, amount numeric, paid_amount numeric, paid boolean,
  paid_at timestamptz, payment_method text, notes text,
  customer_name text, customer_phone text, customer_business text, cr_number text,
  booking_id uuid, tenant_account_id uuid, unit_id uuid, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.invoice_number, i.amount, i.paid_amount, i.paid, i.paid_at,
    i.payment_method, i.notes, i.customer_name, i.customer_phone, i.customer_business, i.cr_number,
    i.booking_id, i.tenant_account_id, i.unit_id, i.created_at
  FROM public.invoices i
  WHERE i.id = _invoice_id
    AND (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
      OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = i.booking_id AND b.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.tenant_accounts ta WHERE ta.id = i.tenant_account_id AND ta.user_id = auth.uid())
    );
$$;
