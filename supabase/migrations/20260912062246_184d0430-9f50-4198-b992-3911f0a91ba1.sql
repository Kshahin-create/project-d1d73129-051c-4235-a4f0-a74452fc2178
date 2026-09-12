CREATE OR REPLACE FUNCTION public.sync_tenant_paid_from_collections()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account uuid := COALESCE(NEW.tenant_account_id, OLD.tenant_account_id);
BEGIN
  UPDATE public.tenant_accounts ta
  SET paid_amount = COALESCE((
    SELECT SUM(uc.amount) FROM public.unit_collections uc
    WHERE uc.tenant_account_id = _account AND uc.is_archived = false
  ), 0),
  updated_at = now()
  WHERE ta.id = _account;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_unit_collections_sync_paid ON public.unit_collections;
CREATE TRIGGER trg_unit_collections_sync_paid
AFTER INSERT OR UPDATE OR DELETE ON public.unit_collections
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_paid_from_collections();

-- Backfill existing data
UPDATE public.tenant_accounts ta
SET paid_amount = COALESCE((
  SELECT SUM(uc.amount) FROM public.unit_collections uc
  WHERE uc.tenant_account_id = ta.id AND uc.is_archived = false
), 0),
updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.unit_collections uc WHERE uc.tenant_account_id = ta.id);