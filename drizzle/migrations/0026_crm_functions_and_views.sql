-- Phase 1 Prompt 5 — CRM writer functions, ownership, masked views

-- Round-robin assignment across active sales agents
CREATE OR REPLACE FUNCTION public.assign_next_agent()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _agents uuid[];
  _idx integer;
BEGIN
  SELECT array_agg(user_id ORDER BY user_id) INTO _agents
  FROM public.user_roles
  WHERE role = 'sales_agent' AND is_active;
  IF _agents IS NULL OR array_length(_agents, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.assignment_state
  SET last_assigned_index = (last_assigned_index + 1) % array_length(_agents, 1)
  WHERE id = 1
  RETURNING last_assigned_index INTO _idx;
  RETURN _agents[_idx + 1];
END $$;

-- Create a party with identity/phone dedupe. Returns jsonb: status created|exists, party, owner_user_id.
CREATE OR REPLACE FUNCTION public.create_party(
  _name_ar text,
  _party_type public.party_type DEFAULT 'individual',
  _id_type text DEFAULT NULL,
  _id_number text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _city text DEFAULT NULL,
  _source text DEFAULT NULL,
  _name_en text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _existing public.parties;
  _owner uuid;
  _seq bigint;
  _party public.parties;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT (public.has_role(_actor, 'sales_agent') OR public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'لا تملك صلاحية إنشاء عميل';
  END IF;
  IF _name_ar IS NULL OR length(trim(_name_ar)) < 2 THEN RAISE EXCEPTION 'اسم العميل مطلوب'; END IF;

  IF _id_type IS NOT NULL AND _id_number IS NOT NULL THEN
    SELECT * INTO _existing FROM public.parties
    WHERE id_type = _id_type AND id_number = _id_number AND archived_at IS NULL LIMIT 1;
    IF FOUND THEN
      SELECT owner_user_id INTO _owner FROM public.opportunities
      WHERE party_id = _existing.id AND outcome IS NULL ORDER BY created_at DESC LIMIT 1;
      RETURN jsonb_build_object('status', 'exists', 'match', 'identity', 'party', to_jsonb(_existing), 'owner_user_id', _owner);
    END IF;
  END IF;

  IF _phone IS NOT NULL AND length(trim(_phone)) > 0 THEN
    SELECT * INTO _existing FROM public.parties
    WHERE phone = _phone AND archived_at IS NULL LIMIT 1;
    IF FOUND THEN
      SELECT owner_user_id INTO _owner FROM public.opportunities
      WHERE party_id = _existing.id AND outcome IS NULL ORDER BY created_at DESC LIMIT 1;
      RETURN jsonb_build_object('status', 'exists', 'match', 'phone', 'party', to_jsonb(_existing), 'owner_user_id', _owner);
    END IF;
  END IF;

  UPDATE public.party_code_counter SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO _seq;

  INSERT INTO public.parties (tenant_code, party_type, name_ar, name_en, id_type, id_number, phone, email, city, source, created_by)
  VALUES ('T-' || lpad(_seq::text, 6, '0'), _party_type, trim(_name_ar), _name_en, _id_type, _id_number, _phone, _email, _city, _source, _actor)
  RETURNING * INTO _party;

  INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, after_data, context)
  VALUES (_actor, 'PARTY_CREATE', 'parties', _party.id::text, to_jsonb(_party), jsonb_build_object('source', _source));

  RETURN jsonb_build_object('status', 'created', 'party', to_jsonb(_party));
END $$;

-- Create an opportunity; owner defaults to the acting agent, else round-robin.
CREATE OR REPLACE FUNCTION public.create_opportunity(
  _party_id uuid,
  _activity_id uuid DEFAULT NULL,
  _area_needed_m2 numeric DEFAULT NULL,
  _source public.opportunity_source DEFAULT 'agent',
  _owner_user_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _next_action text DEFAULT NULL,
  _next_action_at timestamptz DEFAULT NULL
)
RETURNS public.opportunities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _owner uuid;
  _opp public.opportunities;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT (public.has_role(_actor, 'sales_agent') OR public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'لا تملك صلاحية إنشاء فرصة';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parties WHERE id = _party_id AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'العميل غير موجود';
  END IF;

  _owner := COALESCE(_owner_user_id,
    CASE WHEN public.has_role(_actor, 'sales_agent') THEN _actor ELSE public.assign_next_agent() END);

  INSERT INTO public.opportunities (party_id, owner_user_id, activity_id, area_needed_m2, source, notes, next_action, next_action_at, created_by)
  VALUES (_party_id, _owner, _activity_id, _area_needed_m2, _source, _notes, _next_action, _next_action_at, _actor)
  RETURNING * INTO _opp;

  INSERT INTO public.opportunity_owner_history (opportunity_id, from_owner, to_owner, reason, actor_id)
  VALUES (_opp.id, NULL, _owner, 'إسناد أولي', _actor);

  INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, after_data, context)
  VALUES (_actor, 'OPPORTUNITY_CREATE', 'opportunities', _opp.id::text, to_jsonb(_opp), jsonb_build_object('party_id', _party_id));

  RETURN _opp;
END $$;

-- The ONLY stage writer. Allowed moves: forward along the pipeline, park (postponed/waitlist), reopen to qualified, or close with outcome.
CREATE OR REPLACE FUNCTION public.move_opportunity(
  _opportunity_id uuid,
  _to_stage public.opportunity_stage,
  _reason text,
  _outcome public.opportunity_outcome DEFAULT NULL,
  _outcome_reason text DEFAULT NULL,
  _lost_to text DEFAULT NULL,
  _revisit_at timestamptz DEFAULT NULL
)
RETURNS public.opportunities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _opp public.opportunities;
  _before public.opportunities;
  _open_stages public.opportunity_stage[] := ARRAY['new','contacted','qualified','offer_sent','booking_request','on_hold','pending_contract']::public.opportunity_stage[];
  _from_idx integer;
  _to_idx integer;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'السبب مطلوب (5 أحرف على الأقل)'; END IF;

  SELECT * INTO _opp FROM public.opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفرصة غير موجودة'; END IF;
  _before := _opp;

  IF NOT (_opp.owner_user_id = _actor OR public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تعديل هذه الفرصة';
  END IF;
  IF _opp.outcome IS NOT NULL OR _opp.stage = 'won' THEN
    RAISE EXCEPTION 'الفرصة مغلقة ولا يمكن نقلها';
  END IF;

  -- Close with outcome (never deleted)
  IF _outcome IS NOT NULL THEN
    IF _outcome_reason IS NULL OR length(trim(_outcome_reason)) < 5 THEN
      RAISE EXCEPTION 'سبب الإغلاق مطلوب (5 أحرف على الأقل)';
    END IF;
    UPDATE public.opportunities
    SET outcome = _outcome, outcome_reason = _outcome_reason, lost_to = _lost_to, closed_at = now()
    WHERE id = _opp.id RETURNING * INTO _opp;
    INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, before_data, after_data, context)
    VALUES (_actor, 'OPPORTUNITY_CLOSE', 'opportunities', _opp.id::text, to_jsonb(_before), to_jsonb(_opp),
      jsonb_build_object('reason', _reason, 'outcome', _outcome));
    RETURN _opp;
  END IF;

  IF _to_stage = 'postponed' AND _revisit_at IS NULL THEN
    RAISE EXCEPTION 'الفرصة المؤجلة تتطلب تاريخ إعادة زيارة';
  END IF;
  IF _to_stage = 'waitlist' AND _opp.activity_id IS NULL THEN
    RAISE EXCEPTION 'قائمة الانتظار تتطلب تحديد النشاط';
  END IF;

  IF _opp.stage IN ('postponed', 'waitlist') THEN
    IF _to_stage <> 'qualified' THEN
      RAISE EXCEPTION 'الفرصة الموقوفة مؤقتًا تعود إلى مرحلة «مؤهل» أولًا';
    END IF;
  ELSIF _opp.stage = ANY(_open_stages) THEN
    IF _to_stage = ANY(_open_stages) THEN
      _from_idx := array_position(_open_stages, _opp.stage);
      _to_idx := array_position(_open_stages, _to_stage);
      IF _to_idx <= _from_idx THEN
        RAISE EXCEPTION 'لا يمكن الرجوع لمرحلة سابقة؛ استخدم التأجيل أو الإغلاق';
      END IF;
    ELSIF _to_stage NOT IN ('postponed', 'waitlist', 'won') THEN
      RAISE EXCEPTION 'انتقال غير مسموح';
    END IF;
  END IF;
  IF _to_stage = 'won' AND _opp.stage <> 'pending_contract' THEN
    RAISE EXCEPTION 'لا تُغلق الفرصة كمستأجر إلا بعد مرحلة «بانتظار العقد والدفع»';
  END IF;

  UPDATE public.opportunities
  SET stage = _to_stage,
      revisit_at = CASE WHEN _to_stage = 'postponed' THEN _revisit_at ELSE NULL END,
      closed_at = CASE WHEN _to_stage = 'won' THEN now() ELSE closed_at END
  WHERE id = _opp.id RETURNING * INTO _opp;

  INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, before_data, after_data, context)
  VALUES (_actor, 'OPPORTUNITY_MOVE', 'opportunities', _opp.id::text, to_jsonb(_before), to_jsonb(_opp),
    jsonb_build_object('reason', _reason));

  RETURN _opp;
END $$;

-- Log an activity; sets next action in the same transaction; auto-closes after 10 unanswered attempts.
CREATE OR REPLACE FUNCTION public.log_opportunity_activity(
  _opportunity_id uuid,
  _activity_type public.opportunity_activity_type,
  _outcome public.opportunity_activity_outcome,
  _notes text DEFAULT NULL,
  _next_action text DEFAULT NULL,
  _next_action_at timestamptz DEFAULT NULL
)
RETURNS public.opportunities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _opp public.opportunities;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  SELECT * INTO _opp FROM public.opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفرصة غير موجودة'; END IF;
  IF NOT (_opp.owner_user_id = _actor OR public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسجيل نشاط على هذه الفرصة';
  END IF;
  IF _opp.outcome IS NOT NULL OR _opp.stage = 'won' THEN
    RAISE EXCEPTION 'الفرصة مغلقة ولا يمكن تسجيل نشاط عليها';
  END IF;

  INSERT INTO public.opportunity_activities (opportunity_id, activity_type, outcome, notes, next_action, next_action_at, actor_id)
  VALUES (_opportunity_id, _activity_type, _outcome, _notes, _next_action, _next_action_at, _actor);

  UPDATE public.opportunities
  SET next_action = _next_action,
      next_action_at = _next_action_at,
      no_answer_attempts = no_answer_attempts + CASE WHEN _outcome = 'no_answer' THEN 1 ELSE 0 END
  WHERE id = _opportunity_id RETURNING * INTO _opp;

  IF _opp.no_answer_attempts >= 10 AND _opp.outcome IS NULL THEN
    UPDATE public.opportunities
    SET outcome = 'no_answer', outcome_reason = 'إغلاق تلقائي: 10 محاولات بدون رد', closed_at = now()
    WHERE id = _opportunity_id RETURNING * INTO _opp;
    INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, after_data, context)
    VALUES (_actor, 'OPPORTUNITY_AUTO_CLOSE_NO_ANSWER', 'opportunities', _opp.id::text, to_jsonb(_opp),
      jsonb_build_object('attempts', _opp.no_answer_attempts));
  END IF;

  RETURN _opp;
END $$;

-- Transfer request by an agent; leasing manager / admin approves.
CREATE OR REPLACE FUNCTION public.request_transfer(_opportunity_id uuid, _reason text)
RETURNS public.transfer_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _opp public.opportunities;
  _req public.transfer_requests;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT public.has_role(_actor, 'sales_agent') THEN RAISE EXCEPTION 'طلب النقل متاح للوسطاء فقط'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'السبب مطلوب (5 أحرف على الأقل)'; END IF;
  SELECT * INTO _opp FROM public.opportunities WHERE id = _opportunity_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفرصة غير موجودة'; END IF;
  IF _opp.owner_user_id = _actor THEN RAISE EXCEPTION 'أنت مالك هذه الفرصة بالفعل'; END IF;
  IF EXISTS (SELECT 1 FROM public.transfer_requests WHERE opportunity_id = _opportunity_id AND requested_by = _actor AND status = 'pending') THEN
    RAISE EXCEPTION 'لديك طلب نقل معلق لهذه الفرصة';
  END IF;
  INSERT INTO public.transfer_requests (opportunity_id, requested_by, current_owner, reason)
  VALUES (_opportunity_id, _actor, _opp.owner_user_id, _reason)
  RETURNING * INTO _req;
  RETURN _req;
END $$;

CREATE OR REPLACE FUNCTION public.approve_transfer(_request_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS public.transfer_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _req public.transfer_requests;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT (public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'الموافقة على النقل لمدير التأجير فقط';
  END IF;
  SELECT * INTO _req FROM public.transfer_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'تم البت في هذا الطلب مسبقًا'; END IF;

  UPDATE public.transfer_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      decided_by = _actor, decided_at = now(), decision_notes = _notes
  WHERE id = _request_id RETURNING * INTO _req;

  IF _approve THEN
    UPDATE public.opportunities SET owner_user_id = _req.requested_by WHERE id = _req.opportunity_id;
    INSERT INTO public.opportunity_owner_history (opportunity_id, from_owner, to_owner, reason, actor_id)
    VALUES (_req.opportunity_id, _req.current_owner, _req.requested_by, 'نقل بموافقة مدير التأجير: ' || _req.reason, _actor);
    INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, after_data, context)
    VALUES (_actor, 'OPPORTUNITY_TRANSFER', 'opportunities', _req.opportunity_id::text, to_jsonb(_req),
      jsonb_build_object('from_owner', _req.current_owner, 'to_owner', _req.requested_by));
  END IF;
  RETURN _req;
END $$;

-- Bulk reassign all open opportunities of a user (e.g. someone leaves).
CREATE OR REPLACE FUNCTION public.bulk_reassign_opportunities(_from_user uuid, _to_user uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _opp record;
  _count integer := 0;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT (public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'إعادة التوزيع الجماعي لمدير التأجير أو الأدمن فقط';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'السبب مطلوب (5 أحرف على الأقل)'; END IF;
  IF _from_user = _to_user THEN RAISE EXCEPTION 'لا يمكن النقل لنفس المستخدم'; END IF;

  FOR _opp IN SELECT id, owner_user_id FROM public.opportunities
              WHERE owner_user_id = _from_user AND outcome IS NULL AND stage <> 'won' FOR UPDATE
  LOOP
    UPDATE public.opportunities SET owner_user_id = _to_user WHERE id = _opp.id;
    INSERT INTO public.opportunity_owner_history (opportunity_id, from_owner, to_owner, reason, actor_id)
    VALUES (_opp.id, _from_user, _to_user, _reason, _actor);
    _count := _count + 1;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, context)
  VALUES (_actor, 'OPPORTUNITY_BULK_REASSIGN', 'opportunities', NULL,
    jsonb_build_object('from_user', _from_user, 'to_user', _to_user, 'count', _count, 'reason', _reason));
  RETURN _count;
END $$;

-- Cron: reopen postponed opportunities whose revisit date arrived.
CREATE OR REPLACE FUNCTION public.reopen_due_postponed()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _opp record;
  _count integer := 0;
BEGIN
  FOR _opp IN SELECT id, owner_user_id FROM public.opportunities
              WHERE stage = 'postponed' AND revisit_at <= now() AND outcome IS NULL FOR UPDATE
  LOOP
    UPDATE public.opportunities SET stage = 'qualified', revisit_at = NULL WHERE id = _opp.id;
    INSERT INTO public.opportunity_activities (opportunity_id, activity_type, outcome, notes, actor_id)
    VALUES (_opp.id, 'note', 'follow_up', 'إعادة فتح تلقائية: حان تاريخ إعادة الزيارة', _opp.owner_user_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

-- Trigger: when units of an activity get published, waitlisted opportunities return to qualified.
CREATE OR REPLACE FUNCTION public.crm_on_unit_published()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _opp record;
BEGIN
  IF NEW.publish_state = 'published' AND (OLD.publish_state IS DISTINCT FROM 'published') AND NEW.activity_id IS NOT NULL THEN
    FOR _opp IN SELECT id, owner_user_id FROM public.opportunities
                WHERE stage = 'waitlist' AND activity_id = NEW.activity_id AND outcome IS NULL
    LOOP
      UPDATE public.opportunities SET stage = 'qualified' WHERE id = _opp.id;
      INSERT INTO public.opportunity_activities (opportunity_id, activity_type, outcome, notes, actor_id)
      VALUES (_opp.id, 'note', 'follow_up', 'عادت من قائمة الانتظار: نُشرت وحدات بنفس النشاط', _opp.owner_user_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_unit_published_trg AFTER UPDATE OF publish_state ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_unit_published();

-- Masked view: sales agents see contact details only for parties they own an open opportunity for.
CREATE OR REPLACE VIEW public.parties_crm WITH (security_invoker = true) AS
SELECT
  p.id, p.tenant_code, p.party_type, p.name_ar, p.name_en, p.city, p.source,
  p.tenant_lifecycle, p.created_at, p.archived_at,
  CASE WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = p.id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)
    THEN p.phone ELSE NULL END AS phone,
  CASE WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = p.id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)
    THEN p.email ELSE NULL END AS email,
  CASE WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = p.id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)
    THEN p.id_type ELSE NULL END AS id_type,
  CASE WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'manager')
        OR EXISTS (SELECT 1 FROM public.opportunities o WHERE o.party_id = p.id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)
    THEN p.id_number ELSE NULL END AS id_number
FROM public.parties p;
GRANT SELECT ON public.parties_crm TO authenticated;

-- Alerts view: open opportunities without a next action, or overdue.
CREATE OR REPLACE VIEW public.opportunity_alerts WITH (security_invoker = true) AS
SELECT o.id, o.party_id, o.owner_user_id, o.stage, o.next_action, o.next_action_at, o.updated_at,
  CASE WHEN o.next_action_at IS NULL THEN 'بدون إجراء قادم' ELSE 'إجراء متأخر' END AS alert_kind
FROM public.opportunities o
WHERE o.outcome IS NULL AND o.stage NOT IN ('won', 'postponed', 'waitlist')
  AND (o.next_action_at IS NULL OR o.next_action_at < now());
GRANT SELECT ON public.opportunity_alerts TO authenticated;

-- Verification: SELECT proname FROM pg_proc WHERE proname IN ('create_party','create_opportunity','move_opportunity','log_opportunity_activity','assign_next_agent','request_transfer','approve_transfer','bulk_reassign_opportunities','reopen_due_postponed');