-- Rolled-back regression assertions for stage 1 customers. Admin-only; leaves no data behind.
CREATE OR REPLACE FUNCTION public.party_regression_tests(_sales_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin uuid := auth.uid(); _res jsonb := '[]'::jsonb; _r jsonb; _p1 uuid; _p2 uuid; _p3 uuid; _p4 uuid; _p5 uuid;
        _b uuid; _m uuid; _i int; _ok boolean; _txt text; _claims text := current_setting('request.jwt.claims', true);
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN RAISE EXCEPTION 'للأدمن فقط'; END IF;
  BEGIN
    -- 1. Same number written 05… and +966… opens the same customer.
    _r := public.party_upsert('اختبار تكرار الجوال', '0551230001');
    _p1 := (_r->>'party_id')::uuid;
    _r := public.party_upsert('اختبار تكرار ثاني', '+966 55 123 0001');
    _res := _res || jsonb_build_object('t','05 and +966 match the same customer','ok', _r->>'status' = 'exists' AND (_r->>'party_id')::uuid = _p1);

    -- 2. Edit records before/after in the customer history.
    PERFORM public.party_update(_p1, '{"name_ar":"اسم بعد التعديل"}'::jsonb, NULL);
    SELECT EXISTS(SELECT 1 FROM public.audit_log WHERE entity_table='parties' AND entity_id=_p1::text AND action='PARTY_UPDATE'
                  AND before_data->>'name_ar'='اختبار تكرار الجوال' AND after_data->>'name_ar'='اسم بعد التعديل') INTO _ok;
    _res := _res || jsonb_build_object('t','edit logs before and after','ok',_ok);

    -- 3. Close with a listed reason, then a new opportunity re-opens it.
    PERFORM public.party_close(_p1, 'not_interested', NULL);
    SELECT public.party_status(p) = 'closed' AND p.close_reason = 'not_interested' INTO _ok FROM public.parties p WHERE id = _p1;
    _res := _res || jsonb_build_object('t','close moves customer to closed','ok',_ok);
    PERFORM public.create_opportunity(_p1, NULL, NULL, 'call'::public.opportunity_source, NULL, NULL, NULL, NULL);
    SELECT closed_at IS NULL INTO _ok FROM public.parties WHERE id = _p1;
    _res := _res || jsonb_build_object('t','new opportunity re-opens a closed customer','ok',_ok);

    -- 4. Interested row from any source links to the same customer and marks interest.
    INSERT INTO public.interested_customers (full_name, phone, source, created_by) VALUES ('مهتم تيليجرام', '966551230001', 'telegram', _admin);
    SELECT (SELECT party_id FROM public.interested_customers WHERE phone='966551230001' ORDER BY created_at DESC LIMIT 1) = _p1
       AND (SELECT interested_at IS NOT NULL FROM public.parties WHERE id = _p1) INTO _ok;
    _res := _res || jsonb_build_object('t','new interested row links to the existing customer','ok',_ok);

    -- 5. Do-not-contact stays on after re-import.
    PERFORM public.party_set_do_not_contact(_p1, true, 'طلب عدم التواصل');
    _r := public.party_import_preview('اختبار استيراد', 'test.xlsx', '[{"full_name":"اسم من الملف","phone":"0551230001"},{"full_name":"عميل جديد من الملف","phone":"0551230002"},{"full_name":"x","phone":"1"}]'::jsonb);
    _b := (_r->>'batch_id')::uuid;
    _res := _res || jsonb_build_object('t','import preview classifies rows','ok', (_r->'summary'->>'existing')::int = 1 AND (_r->'summary'->>'new')::int = 1 AND (_r->'summary'->>'invalid')::int = 1);
    _r := public.party_import_apply(_b);
    SELECT do_not_contact AND name_ar = 'اسم بعد التعديل' INTO _ok FROM public.parties WHERE id = _p1;
    _res := _res || jsonb_build_object('t','re-import keeps do-not-contact and does not overwrite','ok',_ok AND (_r->>'created')::int = 1);

    -- 6. Duplicate is archived and linked to the original.
    _p2 := (public.party_upsert('ملف مكرر', '0551230003')->>'party_id')::uuid;
    PERFORM public.party_mark_duplicate(_p2, _p1, 'نفس العميل برقم آخر');
    SELECT public.party_status(p) = 'archived' AND duplicate_of_id = _p1 INTO _ok FROM public.parties p WHERE id = _p2;
    _res := _res || jsonb_build_object('t','duplicate archived and linked','ok',_ok);

    -- 7. Full merge moves contact history, unmerge brings it back.
    _p3 := (public.party_upsert('ملف للدمج', '0551230004')->>'party_id')::uuid;
    PERFORM public.log_party_activity(_p3, 'call', 'answered', 'مكالمة اختبار', NULL, NULL);
    _m := (public.party_merge(_p3, _p1, 'دمج اختبار')->>'merge_id')::uuid;
    SELECT NOT EXISTS(SELECT 1 FROM public.party_activities WHERE party_id = _p3)
       AND EXISTS(SELECT 1 FROM public.party_activities WHERE party_id = _p1 AND notes = 'مكالمة اختبار')
       AND (SELECT merged_into_id = _p1 FROM public.parties WHERE id = _p3) INTO _ok;
    _res := _res || jsonb_build_object('t','merge moves contact history','ok',_ok);
    PERFORM public.party_unmerge(_m, 'تراجع اختبار');
    SELECT EXISTS(SELECT 1 FROM public.party_activities WHERE party_id = _p3 AND notes = 'مكالمة اختبار')
       AND (SELECT merged_into_id IS NULL AND archived_at IS NULL FROM public.parties WHERE id = _p3) INTO _ok;
    _res := _res || jsonb_build_object('t','unmerge restores the old file','ok',_ok);

    -- 8. 10 no-answer attempts close the customer as «لا يرد».
    _p4 := (public.party_upsert('لا يرد اختبار', '0551230005')->>'party_id')::uuid;
    FOR _i IN 1..9 LOOP PERFORM public.log_party_activity(_p4, 'call', 'no_answer', NULL, NULL, NULL); END LOOP;
    SELECT closed_at IS NULL INTO _ok FROM public.parties WHERE id = _p4;
    _res := _res || jsonb_build_object('t','9 no-answer attempts keep customer open','ok',_ok);
    PERFORM public.log_party_activity(_p4, 'call', 'no_answer', NULL, NULL, NULL);
    SELECT close_reason = 'no_answer' INTO _ok FROM public.parties WHERE id = _p4;
    _res := _res || jsonb_build_object('t','10th no-answer closes as no_answer','ok',_ok);

    -- 9. Follow-up for a customer without an owner goes to the shared team list.
    _p5 := (public.party_upsert('بدون مسؤول', '0551230006')->>'party_id')::uuid;
    PERFORM public.log_party_activity(_p5, 'call', 'answered', NULL, 'اتصال متابعة', now() + interval '1 day');
    SELECT EXISTS(SELECT 1 FROM public.tasks WHERE entity_type='party' AND entity_id=_p5 AND visibility='team' AND assignee_user_id IS NULL) INTO _ok;
    _res := _res || jsonb_build_object('t','unowned follow-up goes to team list','ok',_ok);

    -- 10. Sales can add customers but cannot merge.
    IF _sales_user IS NOT NULL THEN
      INSERT INTO public.user_role_assignments (user_id, role, is_active, reason) VALUES (_sales_user, 'sales_agent', true, 'اختبار مؤقت');
      PERFORM set_config('request.jwt.claims', json_build_object('sub', _sales_user, 'role', 'authenticated')::text, true);
      _r := public.party_upsert('عميل من السيلز', '0551230007');
      _res := _res || jsonb_build_object('t','sales can add a customer','ok', _r->>'status' = 'created');
      BEGIN
        PERFORM public.party_merge(_p2, _p1, 'محاولة سيلز');
        _ok := false;
      EXCEPTION WHEN OTHERS THEN _ok := SQLERRM LIKE '%للأدمن%';
      END;
      _res := _res || jsonb_build_object('t','sales cannot merge','ok',_ok);
      PERFORM set_config('request.jwt.claims', _claims, true);
    END IF;

    RAISE EXCEPTION 'PARTY_TESTS_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    _txt := SQLERRM;
    IF _txt <> 'PARTY_TESTS_ROLLBACK' THEN
      _res := _res || jsonb_build_object('t','unexpected error','ok',false,'error',_txt);
    END IF;
  END;
  RETURN jsonb_build_object('passed', (SELECT count(*) FROM jsonb_array_elements(_res) e WHERE (e->>'ok')::boolean),
                            'total', jsonb_array_length(_res), 'results', _res);
END $$;
REVOKE ALL ON FUNCTION public.party_regression_tests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.party_regression_tests(uuid) TO authenticated;
SELECT 'party_regression_tests ready' AS status;