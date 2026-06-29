
-- 1) Interested customers table
CREATE TABLE IF NOT EXISTS public.interested_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  requested_activity TEXT,
  business_name TEXT,
  requested_building TEXT,
  requested_unit TEXT,
  customer_source TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'web',  -- web | telegram | manual
  telegram_chat_id BIGINT,
  telegram_message_id BIGINT,
  status TEXT NOT NULL DEFAULT 'new',  -- new | contacted | converted | closed
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interested_customers TO authenticated;
GRANT ALL ON public.interested_customers TO service_role;

ALTER TABLE public.interested_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage interested"
  ON public.interested_customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Anyone authenticated can insert interested"
  ON public.interested_customers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE TRIGGER trg_interested_updated_at
  BEFORE UPDATE ON public.interested_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_interested_phone ON public.interested_customers(phone);
CREATE INDEX IF NOT EXISTS idx_interested_created_at ON public.interested_customers(created_at DESC);

-- 2) Tenant account files table
CREATE TABLE IF NOT EXISTS public.tenant_account_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_account_id UUID NOT NULL REFERENCES public.tenant_accounts(id) ON DELETE CASCADE,
  custom_name TEXT NOT NULL,
  original_name TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_account_files TO authenticated;
GRANT ALL ON public.tenant_account_files TO service_role;

ALTER TABLE public.tenant_account_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tenant files"
  ON public.tenant_account_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Tenant can view own files"
  ON public.tenant_account_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_accounts ta
      WHERE ta.id = tenant_account_files.tenant_account_id
        AND ta.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_tenant_files_updated_at
  BEFORE UPDATE ON public.tenant_account_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_tenant_files_account ON public.tenant_account_files(tenant_account_id);

-- 3) Bookings: returning customer flag + previous customer reference (optional)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_returning_customer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_tenant_account_id UUID REFERENCES public.tenant_accounts(id) ON DELETE SET NULL;
