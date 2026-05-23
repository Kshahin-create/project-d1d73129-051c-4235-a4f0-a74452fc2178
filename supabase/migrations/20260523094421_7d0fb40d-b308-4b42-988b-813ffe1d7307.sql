
-- Helper: ensure tenant_account exists for a given tenant row, return its id
CREATE OR REPLACE FUNCTION public.ensure_tenant_account_for_tenant(_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t RECORD;
  _acc_id uuid;
  _norm_phone text;
BEGIN
  SELECT * INTO _t FROM public.tenants WHERE id = _tenant_id;
  IF NOT FOUND OR _t.tenant_name IS NULL OR btrim(_t.tenant_name) = '' THEN
    RETURN NULL;
  END IF;

  _norm_phone := NULLIF(btrim(COALESCE(_t.phone, '')), '');

  SELECT id INTO _acc_id
  FROM public.tenant_accounts
  WHERE btrim(full_name) = btrim(_t.tenant_name)
    AND COALESCE(NULLIF(btrim(COALESCE(phone, '')), ''), '') = COALESCE(_norm_phone, '')
  LIMIT 1;

  IF _acc_id IS NULL THEN
    INSERT INTO public.tenant_accounts (full_name, phone, business_name, activity_type, notes, cr_number, created_by)
    VALUES (btrim(_t.tenant_name), _norm_phone, _t.business_name, _t.activity_type, _t.notes, _t.cr_number, auth.uid())
    RETURNING id INTO _acc_id;
  END IF;

  RETURN _acc_id;
END;
$$;

-- Trigger function: keep tenant_account_units in sync with tenants
CREATE OR REPLACE FUNCTION public.tenants_sync_account_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acc_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.tenant_account_units WHERE unit_id = OLD.unit_id;
    RETURN OLD;
  END IF;

  -- On UPDATE where tenant identity changed, remove old links for this unit
  IF (TG_OP = 'UPDATE') THEN
    IF btrim(COALESCE(NEW.tenant_name,'')) <> btrim(COALESCE(OLD.tenant_name,''))
       OR COALESCE(NULLIF(btrim(COALESCE(NEW.phone,'')),''),'') <> COALESCE(NULLIF(btrim(COALESCE(OLD.phone,'')),''),'')
    THEN
      DELETE FROM public.tenant_account_units WHERE unit_id = NEW.unit_id;
    END IF;
  END IF;

  _acc_id := public.ensure_tenant_account_for_tenant(NEW.id);
  IF _acc_id IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
    INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
    VALUES (_acc_id, NEW.unit_id, NEW.id)
    ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
    PERFORM public.recalc_tenant_account_total(_acc_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_sync_account_aiu ON public.tenants;
CREATE TRIGGER tenants_sync_account_aiu
AFTER INSERT OR UPDATE OR DELETE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenants_sync_account_trg();

-- One-shot sync for existing rented units that have a tenant row but no account link
CREATE OR REPLACE FUNCTION public.sync_all_rented_units_to_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t RECORD;
  _acc_id uuid;
  _n int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR _t IN
    SELECT t.id, t.unit_id FROM public.tenants t
    JOIN public.units u ON u.id = t.unit_id
    WHERE u.status = 'rented'
      AND NOT EXISTS (SELECT 1 FROM public.tenant_account_units tau WHERE tau.unit_id = t.unit_id)
  LOOP
    _acc_id := public.ensure_tenant_account_for_tenant(_t.id);
    IF _acc_id IS NOT NULL THEN
      INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
      VALUES (_acc_id, _t.unit_id, _t.id)
      ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
      PERFORM public.recalc_tenant_account_total(_acc_id);
      _n := _n + 1;
    END IF;
  END LOOP;

  RETURN _n;
END;
$$;
