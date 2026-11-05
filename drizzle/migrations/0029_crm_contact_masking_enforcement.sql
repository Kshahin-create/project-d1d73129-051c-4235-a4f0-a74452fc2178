-- Phase 1 Prompt 5 — enforce contact masking at DB level + single-assign function

-- Sales agents must not read raw contact columns on the base table.
REVOKE SELECT ON public.parties FROM authenticated;
GRANT SELECT (id, tenant_code, party_type, name_ar, name_en, city, source, tenant_lifecycle, merged_into_id, archived_at, created_by, created_at, updated_at)
  ON public.parties TO authenticated;

-- Recreate the CRM view as an owner-rights view that masks contacts for non-owners.
DROP VIEW IF EXISTS public.parties_crm;
CREATE VIEW public.parties_crm AS
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

-- party_contacts: sales agents see contacts of their own parties only
DROP POLICY IF EXISTS party_contacts_select_crm ON public.party_contacts;
CREATE POLICY party_contacts_select_crm ON public.party_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'leasing_manager')
    OR (public.has_role(auth.uid(), 'sales_agent') AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.party_id = party_contacts.party_id AND o.owner_user_id = auth.uid() AND o.outcome IS NULL)));

-- Assign a single opportunity to an agent (leasing manager / admin)
CREATE OR REPLACE FUNCTION public.assign_opportunity(_opportunity_id uuid, _to_user uuid, _reason text)
RETURNS public.opportunities
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _opp public.opportunities;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'يجب تسجيل الدخول'; END IF;
  IF NOT (public.has_role(_actor, 'leasing_manager') OR public.has_role(_actor, 'admin')) THEN
    RAISE EXCEPTION 'الإسناد لمدير التأجير أو الأدمن فقط';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'السبب مطلوب (5 أحرف على الأقل)'; END IF;
  SELECT * INTO _opp FROM public.opportunities WHERE id = _opportunity_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الفرصة غير موجودة'; END IF;
  IF _opp.outcome IS NOT NULL OR _opp.stage = 'won' THEN RAISE EXCEPTION 'الفرصة مغلقة'; END IF;
  UPDATE public.opportunities SET owner_user_id = _to_user WHERE id = _opp.id RETURNING * INTO _opp;
  INSERT INTO public.opportunity_owner_history (opportunity_id, from_owner, to_owner, reason, actor_id)
  VALUES (_opp.id, _opp.owner_user_id, _to_user, _reason, _actor);
  RETURN _opp;
END $$;

-- Verification: SELECT has_column_privilege('authenticated','public.parties','phone','SELECT'); -- expect false