DO $$ DECLARE d text;BEGIN SELECT pg_get_functiondef('public.unit_import_apply(jsonb,text,text)'::regprocedure) INTO d;IF position('initialize_unit_leasing_status' IN d)=0 THEN d:=replace(d,'RETURNING id INTO _uid;','RETURNING id INTO _uid; PERFORM public.initialize_unit_leasing_status(_uid,''available'',_reason);');EXECUTE d;END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_list_users() RETURNS TABLE(user_id uuid,email text,display_name text,created_at timestamptz,is_admin boolean,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT p.user_id,p.email,p.display_name,p.created_at,public.has_role(p.user_id,'admin'),coalesce((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id=p.user_id AND ur.is_active ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'leasing_manager' THEN 2 WHEN 'manager' THEN 3 WHEN 'control' THEN 4 WHEN 'tenant' THEN 5 ELSE 6 END LIMIT 1),'user') FROM public.profiles p WHERE public.has_role(auth.uid(),'admin') ORDER BY p.created_at DESC;$$;
CREATE OR REPLACE FUNCTION public.unit_status_regression_tests() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;bid uuid;cid uuid;receipt uuid;b public.buildings;result jsonb:='{}';rejected boolean;claims text;actor uuid:=auth.uid();ts timestamptz;
BEGIN
 IF NOT public.has_role(actor,'admin') THEN RAISE EXCEPTION 'اختبارات النظام للأدمن فقط';END IF;
 BEGIN
 SELECT * INTO b FROM public.buildings WHERE booking_enabled AND is_published ORDER BY number LIMIT 1;
 INSERT INTO public.units(building_number,unit_number,unit_type,area,area_m2,activity_id,activity,price,status,publish_state,is_test) VALUES(b.number,2000000000,'اختبار',1,1,b.activity_id,'اختبار معزول',1,'available','draft',true) RETURNING id INTO uid;
 PERFORM public.initialize_unit_leasing_status(uid,'available','تهيئة وحدة اختبار معزولة');
 rejected:=false;BEGIN UPDATE public.units SET leasing_status='leased' WHERE id=uid;EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'فشل منع الكتابة المباشرة';END IF;result:=result||jsonb_build_object('direct_write_rejected',true);
 rejected:=false;BEGIN PERFORM public.set_unit_status(uid,'leased','انتقال غير مسموح','manual',NULL);EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'فشل منع الانتقال غير المسموح';END IF;result:=result||jsonb_build_object('illegal_transition_rejected',true);
 bid:=public.create_booking('اختبار معزول','0500000000',NULL,'اختبار',NULL,ARRAY[uid],'7012345678','full','commercial_registration');
 IF (SELECT leasing_status FROM public.units WHERE id=uid)<>'on_hold' OR (SELECT extract(epoch FROM expires_at-created_at) FROM public.bookings WHERE id=bid)<>172800 THEN RAISE EXCEPTION 'فشل مدة الحجز 48 ساعة';END IF;result:=result||jsonb_build_object('hold_48_hours',true);
 rejected:=false;BEGIN PERFORM public.create_booking('اختبار ثاني','0500000000',NULL,NULL,NULL,ARRAY[uid],'7012345678','full','commercial_registration');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'فشل منع الحجز المزدوج';END IF;result:=result||jsonb_build_object('double_booking_rejected',true);
 INSERT INTO public.user_roles(user_id,role,is_active) VALUES(actor,'leasing_manager',true) ON CONFLICT(user_id,role) DO UPDATE SET is_active=true;
 ts:=public.extend_booking_hold(bid,'اختبار التمديد مرة واحدة');rejected:=false;BEGIN PERFORM public.extend_booking_hold(bid,'اختبار منع التمديد الثاني');EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'فشل حد التمديد';END IF;result:=result||jsonb_build_object('one_extension',true);
 PERFORM public.confirm_booking(bid);IF (SELECT leasing_status FROM public.units WHERE id=uid)<>'pending_contract' THEN RAISE EXCEPTION 'التأكيد لم ينقل لانتظار العقد';END IF;
 cid:=public.register_unit_contract(uid,bid,NULL,'TEST-ROLLBACK',current_date,current_date+30,'عقد اختبار لا يحفظ');PERFORM public.set_unit_contract_state(cid,'active','تفعيل عقد اختبار معزول');
 rejected:=false;BEGIN PERFORM public.set_unit_status(uid,'leased','منع التأجير بدون دفعة','contract',cid);EXCEPTION WHEN OTHERS THEN rejected:=true;END;IF NOT rejected THEN RAISE EXCEPTION 'فشل شرط التحقق من الدفعة';END IF;result:=result||jsonb_build_object('payment_verification_required',true);
 INSERT INTO public.invoices(booking_id,unit_id,amount,paid_amount,paid,created_by) VALUES(bid,uid,1,1,true,actor) RETURNING id INTO receipt;
 PERFORM public.verify_unit_first_payment(cid,'invoice',receipt,'تحقق إيصال اختبار معزول');PERFORM public.set_unit_status(uid,'leased','تأكيد يدوي بعد تحقق الدفعة','contract',cid);
 IF (SELECT leasing_status FROM public.units WHERE id=uid)<>'leased' THEN RAISE EXCEPTION 'فشل التأجير';END IF;result:=result||jsonb_build_object('verified_manual_lease',true);
 PERFORM public.set_unit_contract_state(cid,'terminated','إنهاء عقد الاختبار المعزول');IF (SELECT leasing_status FROM public.units WHERE id=uid)<>'available' THEN RAISE EXCEPTION 'فشل إنهاء العقد';END IF;result:=result||jsonb_build_object('contract_termination_release',true);
 IF (SELECT count(*) FROM public.unit_status_history WHERE unit_id=uid)<>5 THEN RAISE EXCEPTION 'عدد أحداث التاريخ غير صحيح';END IF;result:=result||jsonb_build_object('history_exact',true);
 RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='ROLLBACK_TEST_FIXTURES';
 EXCEPTION WHEN SQLSTATE 'P0002' THEN result:=result||jsonb_build_object('fixtures_rolled_back',true);END;
 RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.unit_status_regression_tests() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.unit_status_regression_tests() TO authenticated;
SELECT count(*) FROM public.units;