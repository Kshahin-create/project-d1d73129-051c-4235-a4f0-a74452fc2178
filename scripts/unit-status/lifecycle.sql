CREATE OR REPLACE FUNCTION public.booking_unit_marks_unit_taken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.bookings b WHERE b.id=NEW.booking_id AND b.status='pending' AND b.archived_at IS NULL) THEN
 PERFORM public.set_unit_status(NEW.unit_id,'on_hold','تسجيل طلب حجز الوحدة','booking',NEW.booking_id); END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.tenant_marks_unit_taken() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.archived_at IS NULL AND EXISTS(SELECT 1 FROM public.units u WHERE u.id=NEW.unit_id AND (u.leasing_status IS NULL OR u.leasing_status NOT IN ('pending_contract','leased'))) THEN RAISE EXCEPTION 'سجل المستأجر يتطلب حجزًا مؤكدًا أو عقدًا موثقًا؛ لا يمكن تغيير حالة الوحدة مباشرة'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.guard_unit_available() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.units_control_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF public.has_role(auth.uid(),'control') AND NOT public.has_role(auth.uid(),'admin') AND (to_jsonb(NEW)-ARRAY['leasing_status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['leasing_status','updated_at']) THEN RAISE EXCEPTION 'صلاحية التحكم للصيانة فقط'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text,_customer_phone text,_customer_email text,_business_name text,_notes text,_unit_ids uuid[],_cr_number text,_payment_plan text,_id_type text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid();bid uuid;u public.units;cnt integer:=0;ta numeric:=0;tp numeric:=0;hours integer;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء حجز'; END IF;
 IF public.has_role(uid,'manager') AND NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'صلاحية المدير للعرض فقط'; END IF;
 IF NOT public.validate_identity(_id_type,btrim(coalesce(_cr_number,''))) OR _id_type IS NULL THEN RAISE EXCEPTION 'رقم الهوية لا يطابق النوع المختار'; END IF;
 IF nullif(btrim(_customer_full_name),'') IS NULL OR nullif(btrim(_customer_phone),'') IS NULL THEN RAISE EXCEPTION 'اسم العميل والجوال مطلوبان'; END IF;
 IF coalesce(cardinality(_unit_ids),0)=0 OR (SELECT count(DISTINCT x) FROM unnest(_unit_ids) x)<>cardinality(_unit_ids) THEN RAISE EXCEPTION 'حدد وحدات صحيحة بدون تكرار'; END IF;
 IF _payment_plan NOT IN ('full','50','70') OR _payment_plan IS NULL THEN RAISE EXCEPTION 'خطة السداد غير صالحة'; END IF;
 SELECT hold_hours INTO hours FROM public.app_settings WHERE id=1; IF hours IS NULL OR hours<=0 THEN RAISE EXCEPTION 'مدة الحجز غير مضبوطة في الإعدادات'; END IF;
 FOR u IN SELECT * FROM public.units WHERE id=ANY(_unit_ids) ORDER BY id FOR UPDATE LOOP
 IF u.leasing_status IS DISTINCT FROM 'available' OR NOT u.leasing_status_initialized THEN RAISE EXCEPTION 'الوحدة % في المبنى % غير متاحة',u.unit_number,u.building_number; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buildings b WHERE b.id=u.building_id AND b.booking_enabled AND (b.is_published OR public.has_role(uid,'admin'))) THEN RAISE EXCEPTION 'المبنى مغلق للحجز'; END IF;
 IF (u.is_test OR u.publish_state<>'published') AND NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'الوحدة غير منشورة للحجز'; END IF;
 cnt:=cnt+1;ta:=ta+u.area;tp:=tp+u.price;
 END LOOP;
 IF cnt<>cardinality(_unit_ids) THEN RAISE EXCEPTION 'بعض الوحدات غير موجودة'; END IF;
 INSERT INTO public.bookings(user_id,customer_full_name,customer_phone,customer_email,business_name,notes,total_area,total_price,units_count,cr_number,payment_plan,id_type,expires_at)
 VALUES(uid,_customer_full_name,_customer_phone,_customer_email,_business_name,_notes,ta,tp,cnt,_cr_number,_payment_plan,_id_type,now()+make_interval(hours=>hours)) RETURNING id INTO bid;
 FOR u IN SELECT * FROM public.units WHERE id=ANY(_unit_ids) ORDER BY id LOOP
 INSERT INTO public.booking_units(booking_id,unit_id,building_number,unit_number,unit_type,area,price,activity) VALUES(bid,u.id,u.building_number,u.unit_number,u.unit_type,u.area,u.price,u.activity);
 END LOOP;
 PERFORM public._safety_audit('CREATE_BOOKING','bookings',bid::text,NULL,(SELECT to_jsonb(b) FROM public.bookings b WHERE id=bid),'طلب حجز مسجل من العميل'); RETURN bid;
END $$;
-- All historical overloads route to the validated implementation.
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text,_customer_phone text,_customer_email text,_business_name text,_notes text,_unit_ids uuid[],_cr_number text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN public.create_booking(_customer_full_name,_customer_phone,_customer_email,_business_name,_notes,_unit_ids,_cr_number,'full',CASE left(btrim(coalesce(_cr_number,'')),1) WHEN '7' THEN 'commercial_registration' WHEN '1' THEN 'national_id' WHEN '2' THEN 'iqama' END); END $$;
CREATE OR REPLACE FUNCTION public.create_booking(_customer_full_name text,_customer_phone text,_customer_email text,_business_name text,_notes text,_unit_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'حدّث نموذج الحجز وحدد نوع الهوية ورقمها'; END $$;
CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings;u record;BEGIN
 PERFORM public._assert_admin_writer(); SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.status<>'pending' OR b.archived_at IS NOT NULL OR b.expires_at<=now() THEN RAISE EXCEPTION 'لا يمكن تأكيد حجز غير معلّق أو منتهٍ'; END IF;
 UPDATE public.bookings SET status='confirmed',updated_at=now() WHERE id=b.id;
 FOR u IN SELECT bu.unit_id FROM public.booking_units bu WHERE bu.booking_id=b.id AND bu.archived_at IS NULL ORDER BY bu.unit_id LOOP
 PERFORM public.set_unit_status(u.unit_id,'pending_contract','تأكيد طلب الحجز وانتظار العقد','booking_confirm',b.id); END LOOP;
 PERFORM public._safety_audit('CONFIRM_BOOKING','bookings',b.id::text,to_jsonb(b),(SELECT to_jsonb(x) FROM public.bookings x WHERE id=b.id),'تأكيد الطلب؛ لا يعني تأجير الوحدة');
END $$;
CREATE OR REPLACE FUNCTION public.confirm_booking(_booking_id uuid,_paid_amount numeric DEFAULT 0) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF coalesce(_paid_amount,0)<>0 THEN RAISE EXCEPTION 'سجّل الدفعة بإيصال مستقل؛ تأكيد الحجز لا يعدّل الأموال'; END IF; PERFORM public.confirm_booking(_booking_id); END $$;
CREATE OR REPLACE FUNCTION public.cancel_booking_with_reason(_booking_id uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings;u record;r text;BEGIN
 r:=public._assert_reason(_reason);SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'الحجز غير موجود'; END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND b.user_id IS DISTINCT FROM auth.uid() AND auth.role()<>'service_role' THEN RAISE EXCEPTION 'غير مصرح بإلغاء الحجز'; END IF;
 IF public.has_role(auth.uid(),'manager') AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'صلاحية المدير للعرض فقط'; END IF;
 IF b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'الحجز غير قابل للإلغاء'; END IF;
 UPDATE public.bookings SET status='cancelled',archived_at=now(),archived_by=auth.uid(),archive_reason=r,updated_at=now() WHERE id=b.id;
 FOR u IN SELECT bu.unit_id FROM public.booking_units bu WHERE bu.booking_id=b.id AND bu.archived_at IS NULL ORDER BY bu.unit_id LOOP
 PERFORM public.set_unit_status(u.unit_id,'available',r,'booking_cancel',b.id); END LOOP;
 PERFORM public._safety_audit('CANCEL','bookings',b.id::text,to_jsonb(b),(SELECT to_jsonb(x) FROM public.bookings x WHERE id=b.id),r);
END $$;
CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.cancel_booking_with_reason(_booking_id,'إلغاء طلب الحجز من صاحبه'); END $$;
CREATE OR REPLACE FUNCTION public.expire_pending_bookings() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings;u record;n integer:=0;BEGIN
 IF NOT (auth.role()='service_role' OR public.has_role(auth.uid(),'admin') OR (auth.uid() IS NULL AND session_user='postgres')) THEN RAISE EXCEPTION 'إنهاء الحجوزات للمهمة المجدولة فقط'; END IF;
 FOR b IN SELECT * FROM public.bookings WHERE status='pending' AND expires_at<=now() AND archived_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LOOP
 BEGIN
 UPDATE public.bookings SET status='expired',updated_at=now() WHERE id=b.id;
 FOR u IN SELECT bu.unit_id FROM public.booking_units bu WHERE bu.booking_id=b.id AND bu.archived_at IS NULL ORDER BY bu.unit_id LOOP
 PERFORM public.set_unit_status(u.unit_id,'available','انتهاء مدة الحجز المؤقت','booking_expiry',b.id); END LOOP;
 PERFORM public._safety_audit('EXPIRE_BOOKING','bookings',b.id::text,to_jsonb(b),(SELECT to_jsonb(x) FROM public.bookings x WHERE id=b.id),'انتهاء مدة الحجز المؤقت');n:=n+1;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'تعذر إنهاء الحجز %: %',b.id,SQLERRM;
 END;
 END LOOP;RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.extend_booking_hold(_booking_id uuid,_reason text) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings;s public.app_settings;result timestamptz;r text;BEGIN
 r:=public._assert_reason(_reason);
 IF NOT public.has_role(auth.uid(),'leasing_manager') THEN RAISE EXCEPTION 'تمديد الحجز لمدير التأجير فقط'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;SELECT * INTO s FROM public.app_settings WHERE id=1;
 IF NOT FOUND OR b.id IS NULL OR b.status<>'pending' OR b.expires_at<=now() OR b.archived_at IS NOT NULL THEN RAISE EXCEPTION 'لا يمكن تمديد حجز منتهٍ أو غير معلّق'; END IF;
 IF b.hold_extensions>=s.max_hold_extensions THEN RAISE EXCEPTION 'تم بلوغ الحد الأقصى لمرات التمديد'; END IF;
 UPDATE public.bookings SET expires_at=expires_at+make_interval(hours=>s.hold_hours),hold_extensions=hold_extensions+1,updated_at=now() WHERE id=b.id RETURNING expires_at INTO result;
 PERFORM public._safety_audit('EXTEND_HOLD','bookings',b.id::text,to_jsonb(b),(SELECT to_jsonb(x) FROM public.bookings x WHERE id=b.id),r);RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.extend_booking_expiry(_booking_id uuid,_hours integer) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'استخدم تمديد الحجز بسبب؛ المدة والحد من إعدادات النظام'; END $$;
CREATE OR REPLACE FUNCTION public.control_set_maintenance(_unit_id uuid,_on boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'سبب الصيانة مطلوب؛ استخدم إجراء تغيير الحالة'; END $$;
-- Existing records are never removed by these legacy release endpoints.
CREATE OR REPLACE FUNCTION public.archive_tenant(_unit_id uuid,_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'إنهاء إشغال الوحدة يتطلب عقدًا منتهيًا أو منهيًا؛ استخدم سجل العقد'; END $$;
CREATE OR REPLACE FUNCTION public.remove_booking_units(_booking_id uuid,_booking_unit_ids uuid[],_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b public.bookings;link public.booking_units;r text;n integer:=0;remaining integer;BEGIN
 PERFORM public._assert_admin_writer();r:=public._assert_reason(_reason);SELECT * INTO b FROM public.bookings WHERE id=_booking_id FOR UPDATE;
 IF NOT FOUND OR b.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'الحجز غير قابل للتعديل'; END IF;
 FOR link IN SELECT * FROM public.booking_units WHERE booking_id=b.id AND id=ANY(_booking_unit_ids) AND archived_at IS NULL ORDER BY unit_id FOR UPDATE LOOP
 UPDATE public.booking_units SET archived_at=now(),archived_by=auth.uid(),archive_reason=r WHERE id=link.id;
 PERFORM public.set_unit_status(link.unit_id,'available',r,'booking_unit_cancel',b.id);
 PERFORM public._safety_audit('ARCHIVE','booking_units',link.id::text,to_jsonb(link),(SELECT to_jsonb(x) FROM public.booking_units x WHERE id=link.id),r);n:=n+1;END LOOP;
 IF n=0 THEN RAISE EXCEPTION 'لا توجد وحدات مختارة داخل الحجز'; END IF;
 SELECT count(*) INTO remaining FROM public.booking_units WHERE booking_id=b.id AND archived_at IS NULL;
 UPDATE public.bookings SET units_count=remaining,total_area=(SELECT coalesce(sum(area),0) FROM public.booking_units WHERE booking_id=b.id AND archived_at IS NULL),total_price=(SELECT coalesce(sum(price),0) FROM public.booking_units WHERE booking_id=b.id AND archived_at IS NULL),status=CASE WHEN remaining=0 THEN 'cancelled' ELSE status END,updated_at=now() WHERE id=b.id;
 RETURN jsonb_build_object('removed',n,'remaining',remaining);
END $$;
SELECT count(*) AS lifecycle_functions FROM pg_proc WHERE proname IN ('create_booking','confirm_booking','expire_pending_bookings','extend_booking_hold');
