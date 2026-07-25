
ALTER TABLE public.tenant_account_files
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID;

CREATE INDEX IF NOT EXISTS idx_tenant_account_files_active
  ON public.tenant_account_files(tenant_account_id, is_archived);

CREATE OR REPLACE FUNCTION public.find_tenant_by_cr(_cr text)
RETURNS TABLE(id uuid, full_name text, business_name text, phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ta.id, ta.full_name, ta.business_name, ta.phone, ta.email
  FROM public.tenant_accounts ta
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND btrim(coalesce(ta.cr_number, '')) <> ''
    AND btrim(ta.cr_number) = btrim(coalesce(_cr, ''))
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.admin_list_tenant_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
RETURNS TABLE(
  id uuid, user_id uuid, full_name text, phone text, email text,
  business_name text, activity_type text, notes text,
  total_price numeric, paid_amount numeric, created_at timestamptz,
  units_count bigint, unpaid_invoices bigint, unpaid_total numeric,
  has_login boolean, cr_number text, files_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name,
    ta.activity_type, ta.notes, ta.total_price, ta.paid_amount, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units tau WHERE tau.tenant_account_id = ta.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0),
    (ta.user_id IS NOT NULL),
    ta.cr_number,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_files f WHERE f.tenant_account_id = ta.id AND f.is_archived = false), 0)
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.full_name;
$$;
