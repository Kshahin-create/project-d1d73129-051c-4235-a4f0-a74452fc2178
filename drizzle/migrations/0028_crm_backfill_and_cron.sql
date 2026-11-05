-- Phase 1 Prompt 5 — one-time backfill of parties from existing data + hourly cron

CREATE OR REPLACE FUNCTION public.crm_backfill_parties()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  _party_id uuid;
  _parties_before integer;
  _parties_after integer;
  _won_count integer;
BEGIN
  SELECT count(*) INTO _parties_before FROM public.parties;

  -- Tenant accounts: party + automatic won opportunity
  FOR r IN SELECT * FROM public.tenant_accounts WHERE party_id IS NULL AND archived_at IS NULL AND merged_into_id IS NULL LOOP
    _party_id := public.crm_ensure_party(r.full_name, r.phone, r.email,
      CASE WHEN r.cr_number IS NOT NULL AND length(trim(r.cr_number)) > 0 THEN 'commercial_registration' END,
      NULLIF(trim(r.cr_number), ''), 'backfill_tenant_accounts');
    UPDATE public.tenant_accounts SET party_id = _party_id WHERE id = r.id;
    IF NOT EXISTS (SELECT 1 FROM public.opportunities WHERE party_id = _party_id AND stage = 'won') THEN
      INSERT INTO public.opportunities (party_id, stage, source, notes, closed_at)
      VALUES (_party_id, 'won', 'platform', 'مستأجر حالي (نقل تلقائي)', now());
    END IF;
    UPDATE public.parties SET tenant_lifecycle = 'active' WHERE id = _party_id AND tenant_lifecycle IS NULL;
  END LOOP;

  FOR r IN SELECT * FROM public.tenants WHERE party_id IS NULL AND archived_at IS NULL LOOP
    _party_id := public.crm_ensure_party(r.tenant_name, r.phone, NULL,
      CASE WHEN r.cr_number IS NOT NULL AND length(trim(r.cr_number)) > 0 THEN 'commercial_registration' END,
      NULLIF(trim(r.cr_number), ''), 'backfill_tenants');
    UPDATE public.tenants SET party_id = _party_id WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT * FROM public.customer_profiles WHERE party_id IS NULL AND archived_at IS NULL LOOP
    _party_id := public.crm_ensure_party(COALESCE(NULLIF(trim(r.full_name), ''), 'بدون اسم'), r.phone, r.email, r.id_type, NULL, 'backfill_customer_profiles');
    UPDATE public.customer_profiles SET party_id = _party_id WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT * FROM public.interested_customers WHERE party_id IS NULL AND archived_at IS NULL LOOP
    _party_id := public.crm_ensure_party(r.full_name, r.phone, NULL, NULL, NULL, 'backfill_interested_customers');
    UPDATE public.interested_customers SET party_id = _party_id WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT * FROM public.leads WHERE party_id IS NULL AND archived_at IS NULL LOOP
    _party_id := public.crm_ensure_party(r.full_name, r.phone, NULL, NULL, NULL, 'backfill_leads');
    UPDATE public.leads SET party_id = _party_id WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT * FROM public.bookings WHERE party_id IS NULL AND archived_at IS NULL LOOP
    _party_id := public.crm_ensure_party(r.customer_full_name, r.customer_phone, r.customer_email, r.id_type, NULLIF(trim(r.cr_number), ''), 'backfill_bookings');
    UPDATE public.bookings SET party_id = _party_id WHERE id = r.id;
    IF r.status IN ('pending', 'confirmed') AND NOT EXISTS (SELECT 1 FROM public.opportunities WHERE booking_id = r.id) THEN
      INSERT INTO public.opportunities (party_id, stage, source, booking_id, notes)
      VALUES (_party_id, CASE WHEN r.status = 'confirmed' THEN 'pending_contract'::public.opportunity_stage ELSE 'booking_request'::public.opportunity_stage END,
              'platform', r.id, 'طلب حجز قائم (نقل تلقائي)');
    END IF;
  END LOOP;

  -- Possible duplicates: same phone, different identity numbers — human review only, never auto-merge
  INSERT INTO public.duplicate_candidates (party_id, candidate_party_id, match_reason)
  SELECT a.id, b.id, 'نفس الجوال بهوية مختلفة'
  FROM public.parties a
  JOIN public.parties b ON a.phone = b.phone AND a.id < b.id
  WHERE a.archived_at IS NULL AND b.archived_at IS NULL AND a.phone IS NOT NULL
    AND COALESCE(a.id_number, '') <> COALESCE(b.id_number, '')
    AND NOT EXISTS (SELECT 1 FROM public.duplicate_candidates d WHERE d.party_id = a.id AND d.candidate_party_id = b.id);

  SELECT count(*) INTO _parties_after FROM public.parties;
  SELECT count(*) INTO _won_count FROM public.opportunities WHERE stage = 'won';

  INSERT INTO public.audit_log (action, entity_table, context)
  VALUES ('CRM_BACKFILL', 'parties', jsonb_build_object('parties_created', _parties_after - _parties_before, 'won_opportunities', _won_count));

  RETURN jsonb_build_object('parties_before', _parties_before, 'parties_after', _parties_after, 'won_opportunities', _won_count);
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_backfill_parties() FROM PUBLIC, anon, authenticated;

SELECT public.crm_backfill_parties();

-- Hourly: reopen postponed opportunities whose revisit date arrived
SELECT cron.schedule('crm-reopen-postponed', '0 * * * *', $$SELECT public.reopen_due_postponed()$$);

-- Verification: SELECT count(*) FROM public.parties; SELECT stage, count(*) FROM public.opportunities GROUP BY stage; SELECT count(*) FROM public.duplicate_candidates;