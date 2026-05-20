
CREATE OR REPLACE FUNCTION public.adjust_payment(
  _tenant_account_id uuid,
  _amount numeric,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ta RECORD;
  _inv_id uuid;
  _inv_num text;
  _unit_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _tenant_account_id IS NULL THEN RAISE EXCEPTION 'tenant_account_id مطلوب'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'مبلغ غير صالح'; END IF;

  SELECT * INTO _ta FROM public.tenant_accounts WHERE id = _tenant_account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'حساب غير موجود'; END IF;

  UPDATE public.tenant_accounts
    SET paid_amount = GREATEST(0, COALESCE(paid_amount,0) + _amount),
        updated_at = now()
    WHERE id = _tenant_account_id;

  SELECT unit_id INTO _unit_id FROM public.tenant_account_units
    WHERE tenant_account_id = _tenant_account_id LIMIT 1;

  _inv_num := public.next_invoice_number();

  INSERT INTO public.invoices (
    tenant_account_id, unit_id, amount, paid_amount, paid, paid_at,
    invoice_number, payment_method, customer_name, customer_phone,
    customer_business, cr_number, notes, created_by
  ) VALUES (
    _tenant_account_id, _unit_id, _amount, _amount, true, now(),
    _inv_num, 'adjustment', _ta.full_name, _ta.phone,
    _ta.business_name, _ta.cr_number,
    COALESCE(_notes, CASE WHEN _amount < 0 THEN 'تعديل/خصم دفعة' ELSE 'تعديل/إضافة دفعة' END),
    auth.uid()
  ) RETURNING id INTO _inv_id;

  RETURN _inv_id;
END;
$$;
