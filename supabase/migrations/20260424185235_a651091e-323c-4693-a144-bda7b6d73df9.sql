
CREATE TABLE public.unit_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  building_number INTEGER NOT NULL,
  unit_number INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('rent', 'release', 'update')),
  previous_status TEXT,
  new_status TEXT,
  reason TEXT NOT NULL,
  tenant_snapshot JSONB,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.unit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_unit ON public.unit_audit_log(unit_id);
CREATE INDEX idx_audit_created ON public.unit_audit_log(created_at DESC);

-- Admins can view all audit logs
CREATE POLICY "Admins view audit log" ON public.unit_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert audit logs
CREATE POLICY "Admins insert audit log" ON public.unit_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = performed_by);

-- No update or delete policies = immutable log
