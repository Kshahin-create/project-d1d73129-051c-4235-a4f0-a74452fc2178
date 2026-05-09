
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_account_units_unit_id_fkey') THEN
    ALTER TABLE public.tenant_account_units ADD CONSTRAINT tenant_account_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_account_units_tenant_account_id_fkey') THEN
    ALTER TABLE public.tenant_account_units ADD CONSTRAINT tenant_account_units_tenant_account_id_fkey FOREIGN KEY (tenant_account_id) REFERENCES public.tenant_accounts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_tenant_account_id_fkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_account_id_fkey FOREIGN KEY (tenant_account_id) REFERENCES public.tenant_accounts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='invoices_unit_id_fkey') THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tenant_login_links_tenant_account_id_fkey') THEN
    ALTER TABLE public.tenant_login_links ADD CONSTRAINT tenant_login_links_tenant_account_id_fkey FOREIGN KEY (tenant_account_id) REFERENCES public.tenant_accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
