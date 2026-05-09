
ALTER TABLE public.tenant_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.tenant_accounts ADD COLUMN IF NOT EXISTS total_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.tenant_accounts ADD COLUMN IF NOT EXISTS activity_type TEXT;

CREATE OR REPLACE FUNCTION public.recalc_tenant_account_total(_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tenant_accounts ta
  SET total_price = COALESCE((
    SELECT SUM(u.price)
    FROM public.tenant_account_units tau
    JOIN public.units u ON u.id = tau.unit_id
    WHERE tau.tenant_account_id = _account_id
  ), 0)
  WHERE ta.id = _account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tenant_account_units_recalc_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_tenant_account_total(OLD.tenant_account_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_tenant_account_total(NEW.tenant_account_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tau_recalc_total ON public.tenant_account_units;
CREATE TRIGGER tau_recalc_total
AFTER INSERT OR DELETE ON public.tenant_account_units
FOR EACH ROW EXECUTE FUNCTION public.tenant_account_units_recalc_trg();

CREATE OR REPLACE FUNCTION public.consolidate_existing_tenants()
RETURNS TABLE (created_accounts INT, linked_units INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grp RECORD;
  _acc_id UUID;
  _existing UUID;
  _linked INT := 0;
  _created INT := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _grp IN
    SELECT
      btrim(t.tenant_name) AS name,
      NULLIF(btrim(COALESCE(t.phone, '')), '') AS phone,
      MAX(t.business_name) FILTER (WHERE t.business_name IS NOT NULL AND btrim(t.business_name) <> '') AS business_name,
      MAX(t.activity_type) FILTER (WHERE t.activity_type IS NOT NULL AND btrim(t.activity_type) <> '') AS activity_type,
      MAX(t.notes) FILTER (WHERE t.notes IS NOT NULL AND btrim(t.notes) <> '') AS notes,
      array_agg(DISTINCT t.unit_id) FILTER (WHERE t.unit_id IS NOT NULL) AS unit_ids
    FROM public.tenants t
    WHERE t.tenant_name IS NOT NULL AND btrim(t.tenant_name) <> ''
    GROUP BY btrim(t.tenant_name), NULLIF(btrim(COALESCE(t.phone, '')), '')
  LOOP
    SELECT id INTO _existing
    FROM public.tenant_accounts
    WHERE btrim(full_name) = _grp.name
      AND COALESCE(NULLIF(btrim(COALESCE(phone, '')), ''), '') = COALESCE(_grp.phone, '')
    LIMIT 1;

    IF _existing IS NULL THEN
      INSERT INTO public.tenant_accounts (full_name, phone, business_name, activity_type, notes, created_by)
      VALUES (_grp.name, _grp.phone, _grp.business_name, _grp.activity_type, _grp.notes, auth.uid())
      RETURNING id INTO _acc_id;
      _created := _created + 1;
    ELSE
      _acc_id := _existing;
      UPDATE public.tenant_accounts
      SET business_name = COALESCE(business_name, _grp.business_name),
          activity_type = COALESCE(activity_type, _grp.activity_type),
          notes = COALESCE(notes, _grp.notes)
      WHERE id = _acc_id;
    END IF;

    IF _grp.unit_ids IS NOT NULL THEN
      INSERT INTO public.tenant_account_units (tenant_account_id, unit_id)
      SELECT _acc_id, u FROM unnest(_grp.unit_ids) AS u
      ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
      _linked := _linked + array_length(_grp.unit_ids, 1);
    END IF;

    PERFORM public.recalc_tenant_account_total(_acc_id);
  END LOOP;

  created_accounts := _created;
  linked_units := _linked;
  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_tenant_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  business_name TEXT,
  activity_type TEXT,
  notes TEXT,
  total_price NUMERIC,
  created_at TIMESTAMPTZ,
  units_count BIGINT,
  unpaid_invoices BIGINT,
  unpaid_total NUMERIC,
  has_login BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name,
    ta.activity_type, ta.notes, ta.total_price, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units tau WHERE tau.tenant_account_id = ta.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    (ta.user_id IS NOT NULL)
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.full_name;
$$;
