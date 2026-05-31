
-- Auto-create tenant_account + link when a unit is rented (tenants row inserted)
CREATE OR REPLACE FUNCTION public.auto_create_tenant_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_phone text;
BEGIN
  v_phone := NULLIF(trim(coalesce(NEW.phone, '')), '');

  -- Try to find an existing account by phone (when phone exists) or by exact name
  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_account_id FROM public.tenant_accounts
    WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM public.tenant_accounts
    WHERE full_name = NEW.tenant_name
      AND coalesce(phone,'') = coalesce(v_phone,'')
    LIMIT 1;
  END IF;

  -- Create new account if none found
  IF v_account_id IS NULL THEN
    INSERT INTO public.tenant_accounts (full_name, phone, business_name, notes, created_by)
    VALUES (NEW.tenant_name, v_phone, NEW.business_name, NEW.notes, auth.uid())
    RETURNING id INTO v_account_id;
  END IF;

  -- Link unit if not already linked
  INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
  SELECT v_account_id, NEW.unit_id, NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_account_units
    WHERE tenant_account_id = v_account_id AND unit_id = NEW.unit_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_tenant_account ON public.tenants;
CREATE TRIGGER trg_auto_create_tenant_account
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.auto_create_tenant_account();

-- Backfill: create tenant_accounts + links for existing tenants rows without an account link
DO $$
DECLARE
  r RECORD;
  v_account_id uuid;
  v_phone text;
BEGIN
  FOR r IN
    SELECT t.* FROM public.tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_account_units tau WHERE tau.unit_id = t.unit_id
    )
  LOOP
    v_phone := NULLIF(trim(coalesce(r.phone, '')), '');
    v_account_id := NULL;

    IF v_phone IS NOT NULL THEN
      SELECT id INTO v_account_id FROM public.tenant_accounts WHERE phone = v_phone LIMIT 1;
    END IF;

    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id FROM public.tenant_accounts
      WHERE full_name = r.tenant_name AND coalesce(phone,'') = coalesce(v_phone,'')
      LIMIT 1;
    END IF;

    IF v_account_id IS NULL THEN
      INSERT INTO public.tenant_accounts (full_name, phone, business_name, notes)
      VALUES (r.tenant_name, v_phone, r.business_name, r.notes)
      RETURNING id INTO v_account_id;
    END IF;

    INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
    SELECT v_account_id, r.unit_id, r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_account_units
      WHERE tenant_account_id = v_account_id AND unit_id = r.unit_id
    );
  END LOOP;
END $$;
