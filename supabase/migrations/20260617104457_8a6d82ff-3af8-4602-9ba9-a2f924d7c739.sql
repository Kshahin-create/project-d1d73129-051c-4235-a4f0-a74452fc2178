-- Remove app_settings from realtime publication (we use polling via get_maintenance_status RPC)
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_settings;

-- Allow managers to insert unit audit log entries (parity with units update policy)
CREATE POLICY "Managers can insert unit audit"
ON public.unit_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager'));
