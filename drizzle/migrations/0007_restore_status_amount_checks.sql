DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_status_check_v2') THEN
    ALTER TABLE public.units ADD CONSTRAINT units_status_check_v2
      CHECK (status IN ('available','rented','reserved','maintenance')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unit_collections_amount_nonzero') THEN
    ALTER TABLE public.unit_collections ADD CONSTRAINT unit_collections_amount_nonzero
      CHECK (amount <> 0 AND (amount > 0 OR reverses_id IS NOT NULL)) NOT VALID;
  END IF;
END $$;
-- Verify: SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('units_status_check_v2','unit_collections_amount_nonzero');