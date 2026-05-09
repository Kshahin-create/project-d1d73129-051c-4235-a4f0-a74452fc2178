
-- 1. Add 'tenant' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tenant';

-- 2. tenant_accounts
CREATE TABLE public.tenant_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  business_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own account" ON public.tenant_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view tenant accounts" ON public.tenant_accounts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins manage tenant accounts" ON public.tenant_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER tenant_accounts_updated_at BEFORE UPDATE ON public.tenant_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. tenant_account_units (linking)
CREATE TABLE public.tenant_account_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_account_id UUID NOT NULL REFERENCES public.tenant_accounts(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL,
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_account_id, unit_id)
);
ALTER TABLE public.tenant_account_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own unit links" ON public.tenant_account_units
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_accounts ta WHERE ta.id = tenant_account_units.tenant_account_id AND ta.user_id = auth.uid()));
CREATE POLICY "Admins view all unit links" ON public.tenant_account_units
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins manage unit links" ON public.tenant_account_units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 4. invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_account_id UUID NOT NULL REFERENCES public.tenant_accounts(id) ON DELETE CASCADE,
  unit_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_accounts ta WHERE ta.id = invoices.tenant_account_id AND ta.user_id = auth.uid()));
CREATE POLICY "Admins view invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. tenant_login_links
CREATE TABLE public.tenant_login_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_account_id UUID NOT NULL REFERENCES public.tenant_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_login_links ENABLE ROW LEVEL SECURITY;
-- only service role accesses this; no policies needed for normal users

-- 6. Allow tenants to see their own units via SELECT policy on units
CREATE POLICY "Tenants view linked units" ON public.units
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.tenant_account_units tau
    JOIN public.tenant_accounts ta ON ta.id = tau.tenant_account_id
    WHERE tau.unit_id = units.id AND ta.user_id = auth.uid()
  ));

-- 7. Helper RPC: link units to a tenant account (admin/manager only)
CREATE OR REPLACE FUNCTION public.admin_link_tenant_units(_tenant_account_id UUID, _unit_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _unit_ids IS NULL OR array_length(_unit_ids, 1) IS NULL THEN RETURN; END IF;
  INSERT INTO public.tenant_account_units (tenant_account_id, unit_id)
  SELECT _tenant_account_id, u FROM unnest(_unit_ids) AS u
  ON CONFLICT (tenant_account_id, unit_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlink_tenant_unit(_tenant_account_id UUID, _unit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.tenant_account_units
  WHERE tenant_account_id = _tenant_account_id AND unit_id = _unit_id;
END;
$$;

-- 8. List tenant accounts with stats
CREATE OR REPLACE FUNCTION public.admin_list_tenant_accounts()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  business_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  units_count BIGINT,
  unpaid_invoices BIGINT,
  unpaid_total NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ta.id, ta.user_id, ta.full_name, ta.phone, ta.email, ta.business_name, ta.notes, ta.created_at,
    COALESCE((SELECT COUNT(*) FROM public.tenant_account_units tau WHERE tau.tenant_account_id = ta.id), 0) AS units_count,
    COALESCE((SELECT COUNT(*) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_invoices,
    COALESCE((SELECT SUM(i.amount - i.paid_amount) FROM public.invoices i WHERE i.tenant_account_id = ta.id AND i.paid = false), 0) AS unpaid_total
  FROM public.tenant_accounts ta
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ORDER BY ta.created_at DESC;
$$;
