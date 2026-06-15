
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  table_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  kind TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_backups TO authenticated;
GRANT ALL ON public.system_backups TO service_role;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backups" ON public.system_backups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert backups" ON public.system_backups
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete backups" ON public.system_backups
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
