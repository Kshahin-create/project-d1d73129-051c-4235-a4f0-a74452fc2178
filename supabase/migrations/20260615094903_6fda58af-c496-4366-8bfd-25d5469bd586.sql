
CREATE POLICY "Admins read backup files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write backup files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'system-backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update backup files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete backup files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(),'admin'));
