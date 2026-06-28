
-- 1. unit_files table
CREATE TABLE public.unit_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX unit_files_unit_id_idx ON public.unit_files(unit_id);
CREATE INDEX unit_files_created_at_idx ON public.unit_files(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_files TO authenticated;
GRANT ALL ON public.unit_files TO service_role;

ALTER TABLE public.unit_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_view_unit_files"
  ON public.unit_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "admin_manager_insert_unit_files"
  ON public.unit_files FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "admin_manager_update_unit_files"
  ON public.unit_files FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "admin_manager_delete_unit_files"
  ON public.unit_files FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- 2. Storage policies for unit-files bucket (admin/manager only)
CREATE POLICY "unit_files_read_admin_manager"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'unit-files'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );

CREATE POLICY "unit_files_insert_admin_manager"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'unit-files'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );

CREATE POLICY "unit_files_update_admin_manager"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'unit-files'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  )
  WITH CHECK (
    bucket_id = 'unit-files'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );

CREATE POLICY "unit_files_delete_admin_manager"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'unit-files'
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  );
