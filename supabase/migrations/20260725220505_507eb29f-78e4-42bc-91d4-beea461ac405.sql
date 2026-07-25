
-- 1) unit_collections table
CREATE TABLE public.unit_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_account_id UUID NOT NULL REFERENCES public.tenant_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  proof_path TEXT,
  proof_name TEXT,
  proof_mime TEXT,
  proof_size BIGINT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_collections TO authenticated;
GRANT ALL ON public.unit_collections TO service_role;

ALTER TABLE public.unit_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage collections"
  ON public.unit_collections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "managers read collections"
  ON public.unit_collections FOR SELECT
  USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "tenant reads own collections"
  ON public.unit_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_accounts ta
      WHERE ta.id = tenant_account_id AND ta.user_id = auth.uid()
    )
  );

CREATE INDEX idx_unit_collections_unit ON public.unit_collections(unit_id);
CREATE INDEX idx_unit_collections_tenant ON public.unit_collections(tenant_account_id);

CREATE TRIGGER trg_unit_collections_updated
  BEFORE UPDATE ON public.unit_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storage policies for unit-collection-proofs bucket
CREATE POLICY "admin manages collection proofs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'unit-collection-proofs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'unit-collection-proofs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "manager reads collection proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'unit-collection-proofs' AND public.has_role(auth.uid(), 'manager'));

CREATE POLICY "tenant reads own collection proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'unit-collection-proofs'
    AND EXISTS (
      SELECT 1
      FROM public.unit_collections uc
      JOIN public.tenant_accounts ta ON ta.id = uc.tenant_account_id
      WHERE uc.proof_path = storage.objects.name AND ta.user_id = auth.uid()
    )
  );

-- 3) Update admin_list_tenant_accounts to include collected_total
DROP FUNCTION IF EXISTS public.admin_list_tenant_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  email text,
  business_name text,
  activity_type text,
  notes text,
  total_price numeric,
  paid_amount numeric,
  created_at timestamptz,
  units_count bigint,
  unpaid_invoices bigint,
  unpaid_total numeric,
  has_login boolean,
  cr_number text,
  files_count bigint,
  collected_total numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ta.id,
    ta.user_id,
    ta.full_name,
    ta.phone,
    ta.email,
    ta.business_name,
    ta.activity_type,
    ta.notes,
    ta.total_price,
    ta.paid_amount,
    ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units u WHERE u.tenant_account_id = ta.id), 0) AS units_count,
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_invoices,
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_total,
    (ta.user_id IS NOT NULL) AS has_login,
    ta.cr_number,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_files f WHERE f.tenant_account_id = ta.id AND f.is_archived = false), 0) AS files_count,
    COALESCE((SELECT SUM(c.amount) FROM public.unit_collections c WHERE c.tenant_account_id = ta.id AND c.is_archived = false), 0) AS collected_total
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tenant_accounts() TO authenticated;
