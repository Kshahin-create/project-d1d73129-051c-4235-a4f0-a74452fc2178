ALTER POLICY "unit_files_insert_admin_manager" ON storage.objects WITH CHECK (bucket_id = 'unit-files' AND public.has_role(auth.uid(), 'admin'));
ALTER POLICY "unit_files_update_admin_manager" ON storage.objects USING (bucket_id = 'unit-files' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'unit-files' AND public.has_role(auth.uid(), 'admin'));
ALTER POLICY "unit_files_delete_admin_manager" ON storage.objects USING (bucket_id = 'unit-files' AND public.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins manage tenant storage files" ON storage.objects USING (bucket_id = 'tenant-account-files' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'tenant-account-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers read tenant storage files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'tenant-account-files' AND public.has_role(auth.uid(), 'manager'));
ALTER POLICY "Staff can insert interested" ON public.interested_customers WITH CHECK (created_by = auth.uid() AND public.has_role(auth.uid(), 'admin') AND COALESCE(source, 'manual') = ANY (ARRAY['web','manual','telegram']));
DO $migration$
DECLARE f record; definition text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.prosecdef AND l.lanname='plpgsql' AND p.prorettype <> 'trigger'::regtype AND p.proname = ANY(ARRAY['adjust_payment','expire_pending_bookings','create_booking','confirm_booking','cancel_booking','record_payment','set_booking_paid_amount','set_tenant_account_paid_amount','extend_booking_expiry','admin_link_tenant_units','admin_unlink_tenant_unit','admin_merge_tenant_accounts','admin_auto_merge_duplicate_tenants','merge_duplicate_tenant_accounts','consolidate_existing_tenants','sync_all_rented_units_to_accounts','ensure_tenant_account_for_tenant','recalc_tenant_account_total','import_leads','mark_booking_whatsapp_sent','next_invoice_number','next_offer_number']) LOOP
    definition := pg_get_functiondef(f.oid);
    definition := regexp_replace(definition, '\mBEGIN\M', E'BEGIN\n  IF public.has_role(auth.uid(), ''manager'') AND NOT public.has_role(auth.uid(), ''admin'') THEN\n    RAISE EXCEPTION ''صلاحية المدير للعرض فقط'' USING ERRCODE = ''42501'';\n  END IF;', 'i');
    EXECUTE definition;
  END LOOP;
END;
$migration$;