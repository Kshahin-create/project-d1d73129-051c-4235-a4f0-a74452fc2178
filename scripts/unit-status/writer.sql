-- A private, transaction-scoped capability is not forgeable by API roles.
CREATE TABLE IF NOT EXISTS public.unit_status_write_capabilities(transaction_id bigint NOT NULL,unit_id uuid NOT NULL,PRIMARY KEY(transaction_id,unit_id));
GRANT ALL ON public.unit_status_write_capabilities TO postgres;
REVOKE ALL ON public.unit_status_write_capabilities FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.unit_status_write_capabilities ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.unit_status_write_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.leasing_status IS NOT NULL OR NEW.leasing_status_initialized THEN RAISE EXCEPTION 'تهيئة حالة الوحدة تتم من الوظيفة المعتمدة فقط'; END IF;
   RETURN NEW;
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status OR NEW.status_before_maintenance IS DISTINCT FROM OLD.status_before_maintenance THEN RAISE EXCEPTION 'الحالة القديمة للقراءة فقط؛ استخدم إجراء تغيير الحالة المعتمد' USING ERRCODE='42501'; END IF;
 IF NEW.leasing_status IS DISTINCT FROM OLD.leasing_status OR NEW.leasing_status_initialized IS DISTINCT FROM OLD.leasing_status_initialized THEN
   IF NOT EXISTS(SELECT 1 FROM public.unit_status_write_capabilities WHERE transaction_id=txid_current() AND unit_id=NEW.id) THEN RAISE EXCEPTION 'تغيير حالة الوحدة مسموح من الإجراء المعتمد فقط' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.set_unit_status(unit_id uuid,new_status public.unit_leasing_status,reason text,ref_type text,ref_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.units;b public.bookings;c public.unit_contracts;r text;actor uuid:=auth.uid();ar text;before_row jsonb;v record;
BEGIN
 r:=public._assert_reason(reason);
 SELECT * INTO u FROM public.units WHERE id=unit_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'الوحدة غير موجودة'; END IF;
 SELECT role::text INTO ar FROM public.user_roles WHERE user_id=actor ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END LIMIT 1;
 IF public.has_role(actor,'manager') AND NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'صلاحية المدير للعرض فقط'; END IF;
 IF public.has_role(actor,'control') AND NOT public.has_role(actor,'admin') THEN
  IF NOT((u.leasing_status='available' AND new_status='maintenance') OR (u.leasing_status='maintenance' AND new_status='available')) OR ref_type<>'maintenance' THEN RAISE EXCEPTION 'صلاحية التحكم للصيانة فقط'; END IF;
 ELSIF NOT public.has_role(actor,'admin') THEN
  IF ref_type NOT IN ('booking','booking_cancel','booking_expiry') THEN RAISE EXCEPTION 'غير مصرح بتغيير حالة الوحدة'; END IF;
 END IF;
 IF ref_type IN ('booking','booking_confirm','booking_cancel','booking_expiry','booking_unit_cancel') THEN
  SELECT * INTO b FROM public.bookings WHERE id=ref_id;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.booking_units bu WHERE bu.booking_id=b.id AND bu.unit_id=u.id) THEN RAISE EXCEPTION 'مرجع الحجز لا يخص الوحدة'; END IF;
  IF NOT public.has_role(actor,'admin') AND NOT ((b.user_id=actor AND ref_type IN ('booking','booking_cancel')) OR (ref_type='booking_expiry' AND (auth.role()='service_role' OR (actor IS NULL AND session_user='postgres')))) THEN RAISE EXCEPTION 'غير مصرح بإدارة هذا الحجز'; END IF;
 END IF;
 IF NOT u.leasing_status_initialized THEN RAISE EXCEPTION 'حالة الوحدة تحتاج مراجعة قبل أي انتقال'; END IF;
 IF u.leasing_status IS NULL THEN RAISE EXCEPTION 'حالة الوحدة غير محسومة؛ راجع سجل المراجعة'; END IF;
 IF NOT ((u.leasing_status='available' AND new_status IN ('on_hold','maintenance','blocked')) OR (u.leasing_status='on_hold' AND new_status IN ('pending_contract','available')) OR (u.leasing_status='pending_contract' AND new_status IN ('leased','available')) OR (u.leasing_status IN ('leased','maintenance','blocked') AND new_status='available')) THEN RAISE EXCEPTION 'انتقال حالة الوحدة غير مسموح: % ← %',u.leasing_status,new_status; END IF;
 IF new_status='on_hold' AND (ref_type<>'booking' OR b.status<>'pending' OR b.expires_at<=now() OR b.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'الحجز المؤقت يتطلب طلب حجز صالح'; END IF;
 IF new_status='pending_contract' AND (ref_type<>'booking_confirm' OR b.status<>'confirmed' OR b.archived_at IS NOT NULL) THEN RAISE EXCEPTION 'انتظار العقد يتطلب تأكيد الحجز'; END IF;
 IF new_status='available' AND u.leasing_status IN ('on_hold','pending_contract') THEN
  IF NOT((ref_type='booking_cancel' AND b.status='cancelled') OR (ref_type='booking_expiry' AND b.status='expired' AND u.leasing_status='on_hold') OR (ref_type='booking_unit_cancel' AND EXISTS(SELECT 1 FROM public.booking_units bu WHERE bu.booking_id=b.id AND bu.unit_id=u.id AND bu.archived_at IS NOT NULL))) THEN RAISE EXCEPTION 'تحرير الوحدة يتطلب إلغاء أو انتهاء موثق'; END IF;
 END IF;
 IF new_status='leased' OR (new_status='available' AND u.leasing_status='leased') THEN
  SELECT * INTO c FROM public.unit_contracts WHERE id=ref_id AND unit_id=u.id FOR UPDATE;
  IF NOT FOUND OR ref_type<>'contract' THEN RAISE EXCEPTION 'مرجع عقد الوحدة مطلوب'; END IF;
  IF new_status='leased' THEN
   IF NOT public.has_role(actor,'admin') OR c.status<>'active' OR c.starts_on>current_date OR c.ends_on<current_date THEN RAISE EXCEPTION 'التأجير يتطلب عقدًا فعالًا وتأكيدًا يدويًا من الأدمن'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.unit_first_payment_verifications pv WHERE pv.contract_id=c.id AND ((pv.receipt_type='invoice' AND EXISTS(SELECT 1 FROM public.invoices i WHERE i.id=pv.receipt_id AND i.archived_at IS NULL AND i.reverses_id IS NULL AND i.paid_amount>0 AND NOT EXISTS(SELECT 1 FROM public.invoices ri WHERE ri.reverses_id=i.id))) OR (pv.receipt_type='collection' AND EXISTS(SELECT 1 FROM public.unit_collections x WHERE x.id=pv.receipt_id AND NOT x.is_archived AND x.reverses_id IS NULL AND x.amount>0 AND NOT EXISTS(SELECT 1 FROM public.unit_collections rx WHERE rx.reverses_id=x.id))))) THEN RAISE EXCEPTION 'أول دفعة لم يتم التحقق منها أو تم عكس إيصالها'; END IF;
  ELSIF c.status NOT IN ('ended','terminated') THEN RAISE EXCEPTION 'لا يمكن تحرير وحدة مؤجرة قبل انتهاء أو إنهاء عقدها'; END IF;
 END IF;
 IF new_status IN ('available','on_hold') THEN
  IF EXISTS(SELECT 1 FROM public.tenants t WHERE t.unit_id=u.id AND t.archived_at IS NULL) OR EXISTS(SELECT 1 FROM public.unit_contracts ct WHERE ct.unit_id=u.id AND ct.status='active') OR EXISTS(SELECT 1 FROM public.booking_units bu JOIN public.bookings ob ON ob.id=bu.booking_id WHERE bu.unit_id=u.id AND bu.archived_at IS NULL AND ob.archived_at IS NULL AND ob.status IN ('pending','confirmed') AND (new_status='available' OR ob.id IS DISTINCT FROM b.id)) THEN RAISE EXCEPTION 'الوحدة مرتبطة بإشغال أو حجز آخر؛ لا يمكن إتاحتها أو حجزها'; END IF;
 END IF;
 before_row:=to_jsonb(u);
 INSERT INTO public.unit_status_write_capabilities VALUES(txid_current(),u.id) ON CONFLICT DO NOTHING;
 UPDATE public.units SET leasing_status=new_status,updated_at=now() WHERE id=u.id;
 DELETE FROM public.unit_status_write_capabilities WHERE transaction_id=txid_current() AND unit_status_write_capabilities.unit_id=u.id;
 INSERT INTO public.unit_status_history(unit_id,from_status,to_status,actor,actor_role,reason,ref_type,ref_id) VALUES(u.id,u.leasing_status,new_status,actor,coalesce(ar,'system'),r,ref_type,ref_id);
 INSERT INTO public.audit_log(actor_id,actor_role,action,entity_table,entity_id,before_data,after_data,context) VALUES(actor,coalesce(ar,'system'),'UNIT_STATUS_TRANSITION','units',u.id::text,before_row,(SELECT to_jsonb(z) FROM public.units z WHERE z.id=u.id),jsonb_build_object('reason',r,'ref_type',ref_type,'ref_id',ref_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.set_unit_status(uuid,public.unit_leasing_status,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_unit_status(uuid,public.unit_leasing_status,text,text,uuid) TO authenticated,service_role;
SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='set_unit_status') AS writer_exists;
