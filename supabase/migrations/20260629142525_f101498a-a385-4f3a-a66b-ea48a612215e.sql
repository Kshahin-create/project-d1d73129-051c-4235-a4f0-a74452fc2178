
CREATE POLICY "Admins manage tenant storage files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'tenant-account-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (bucket_id = 'tenant-account-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));

CREATE POLICY "Tenants view own storage files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tenant-account-files'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_account_files f
      JOIN public.tenant_accounts ta ON ta.id = f.tenant_account_id
      WHERE f.storage_path = storage.objects.name
        AND ta.user_id = auth.uid()
    )
  );
