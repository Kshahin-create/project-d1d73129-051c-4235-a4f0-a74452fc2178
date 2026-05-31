
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

  IF v_account_id IS NULL THEN
    INSERT INTO public.tenant_accounts (full_name, phone, business_name, notes, created_by)
    VALUES (NEW.tenant_name, v_phone, NEW.business_name, NEW.notes, auth.uid())
    RETURNING id INTO v_account_id;
  END IF;

  -- Replace any old link on this unit so it reflects the current tenant
  DELETE FROM public.tenant_account_units
  WHERE unit_id = NEW.unit_id AND tenant_account_id <> v_account_id;

  INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
  SELECT v_account_id, NEW.unit_id, NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenant_account_units
    WHERE tenant_account_id = v_account_id AND unit_id = NEW.unit_id
  );

  RETURN NEW;
END;
$$;

-- Backfill: re-sync every current tenants row
DO $$
DECLARE
  r RECORD;
  v_account_id uuid;
  v_phone text;
BEGIN
  FOR r IN SELECT * FROM public.tenants LOOP
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

    DELETE FROM public.tenant_account_units
    WHERE unit_id = r.unit_id AND tenant_account_id <> v_account_id;

    INSERT INTO public.tenant_account_units (tenant_account_id, unit_id, tenant_id)
    SELECT v_account_id, r.unit_id, r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.tenant_account_units
      WHERE tenant_account_id = v_account_id AND unit_id = r.unit_id
    );
  END LOOP;
END $$;
