
-- 1) Data quality resolutions (human review outcomes)
CREATE TABLE IF NOT EXISTS public.data_quality_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_code text NOT NULL,
  entity_table text NOT NULL,
  entity_id text NOT NULL,
  resolution text NOT NULL,
  reason text,
  resolved_by uuid,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (check_code, entity_table, entity_id)
);
GRANT SELECT ON public.data_quality_resolutions TO authenticated;
GRANT ALL ON public.data_quality_resolutions TO service_role;
ALTER TABLE public.data_quality_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_quality_resolutions_admin_read ON public.data_quality_resolutions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 2) Daily count snapshots
CREATE TABLE IF NOT EXISTS public.data_quality_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_code text NOT NULL,
  finding_count integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_quality_snapshots TO authenticated;
GRANT ALL ON public.data_quality_snapshots TO service_role;
ALTER TABLE public.data_quality_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_quality_snapshots_admin_read ON public.data_quality_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 3) Raw findings view (live data, no resolution filtering)
CREATE OR REPLACE VIEW public.data_quality_findings_raw AS
SELECT 'leased_without_contract'::text AS check_code, 'units'::text AS entity_table, u.id::text AS entity_id,
       ('مبنى ' || u.building_number || ' وحدة ' || u.unit_number)::text AS label,
       'وحدة مؤجرة بدون عقد نشط'::text AS detail
FROM public.units u
WHERE u.status = 'leased' AND COALESCE(u.is_test, false) = false
  AND NOT EXISTS (SELECT 1 FROM public.contract_units cu JOIN public.contracts c ON c.id = cu.contract_id
                  WHERE cu.unit_id = u.id AND c.status = 'active')
UNION ALL
SELECT 'contract_without_installments', 'contracts', c.id::text,
       ('عقد ' || c.contract_no), 'عقد نشط بدون أقساط'
FROM public.contracts c
WHERE c.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.installments i WHERE i.contract_id = c.id)
UNION ALL
SELECT 'receipt_missing_proof_or_allocation', 'receipts', r.id::text,
       ('إيصال ' || COALESCE(r.receipt_no, r.id::text)),
       'إيصال بدون ملف إثبات أو بدون تخصيص على قسط'
FROM public.receipts r
WHERE r.archived_at IS NULL AND r.reverses_id IS NULL AND COALESCE(r.status, '') <> 'reversed'
  AND (r.proof_file IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.receipt_allocations ra WHERE ra.receipt_id = r.id))
UNION ALL
SELECT 'published_unit_incomplete', 'units', u.id::text,
       ('مبنى ' || u.building_number || ' وحدة ' || u.unit_number),
       'وحدة منشورة بدون مبنى أو نشاط أو مساحة'
FROM public.units u
WHERE u.publish_state = 'published' AND COALESCE(u.is_test, false) = false
  AND (u.building_id IS NULL OR u.activity_id IS NULL OR u.area IS NULL)
UNION ALL
SELECT 'party_on_available_unit', 'units', u.id::text,
       ('مبنى ' || u.building_number || ' وحدة ' || u.unit_number),
       'وحدة متاحة وعليها مستأجر أو عقد نشط'
FROM public.units u
WHERE u.status = 'available' AND COALESCE(u.is_test, false) = false
  AND (EXISTS (SELECT 1 FROM public.tenant_account_units tau WHERE tau.unit_id = u.id)
       OR EXISTS (SELECT 1 FROM public.contract_units cu JOIN public.contracts c ON c.id = cu.contract_id
                  WHERE cu.unit_id = u.id AND c.status = 'active'))
UNION ALL
SELECT 'hold_expired', 'units', u.id::text,
       ('مبنى ' || u.building_number || ' وحدة ' || u.unit_number),
       'حجز منتهي الصلاحية والوحدة ما زالت محجوزة'
FROM public.units u
WHERE u.status = 'on_hold' AND COALESCE(u.is_test, false) = false
  AND EXISTS (SELECT 1 FROM public.booking_units bu JOIN public.bookings b ON b.id = bu.booking_id
              WHERE bu.unit_id = u.id AND b.status IN ('pending', 'confirmed') AND b.expires_at < now())
UNION ALL
SELECT 'collections_receipts_mismatch', 'finance', 'totals',
       'إجمالي التحصيلات القديمة مقابل الإيصالات',
       ('تحصيلات: ' || COALESCE((SELECT SUM(uc.amount) FROM public.unit_collections uc
              WHERE uc.is_archived = false AND uc.reverses_id IS NULL), 0)::text
        || ' — إيصالات قبل الضريبة: ' || COALESCE((SELECT SUM(r.amount_excl_vat) FROM public.receipts r
              WHERE r.archived_at IS NULL AND r.reverses_id IS NULL AND COALESCE(r.status,'') <> 'reversed'), 0)::text)
WHERE ABS(COALESCE((SELECT SUM(uc.amount) FROM public.unit_collections uc
              WHERE uc.is_archived = false AND uc.reverses_id IS NULL), 0)
        - COALESCE((SELECT SUM(r.amount_excl_vat) FROM public.receipts r
              WHERE r.archived_at IS NULL AND r.reverses_id IS NULL AND COALESCE(r.status,'') <> 'reversed'), 0)) > 0.01
UNION ALL
SELECT 'duplicate_parties_unreviewed', 'duplicate_candidates', d.id::text,
       ('تكرار محتمل: ' || COALESCE(d.match_reason, '')), 'طرفان مكرران محتملان لم تتم مراجعتهما'
FROM public.duplicate_candidates d
WHERE d.status = 'pending';

-- 4) Read function: findings minus resolved ones, admin/manager only
CREATE OR REPLACE FUNCTION public.admin_data_quality_checks()
RETURNS TABLE (check_code text, entity_table text, entity_id text, label text, detail text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.check_code, f.entity_table, f.entity_id, f.label, f.detail
  FROM public.data_quality_findings_raw f
  WHERE (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    AND NOT EXISTS (
      SELECT 1 FROM public.data_quality_resolutions r
      WHERE r.check_code = f.check_code AND r.entity_table = f.entity_table AND r.entity_id = f.entity_id
    );
$$;
REVOKE ALL ON FUNCTION public.admin_data_quality_checks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_data_quality_checks() TO authenticated;

-- 5) Resolve a finding: corrected or exception (reason required), audited
CREATE OR REPLACE FUNCTION public.resolve_data_quality_finding(
  p_check_code text, p_entity_table text, p_entity_id text, p_resolution text, p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'غير مصرح لك بمعالجة ملاحظات جودة البيانات';
  END IF;
  IF p_resolution NOT IN ('corrected', 'exception') THEN
    RAISE EXCEPTION 'نوع المعالجة غير صالح';
  END IF;
  IF p_resolution = 'exception' AND (p_reason IS NULL OR length(trim(p_reason)) < 5) THEN
    RAISE EXCEPTION 'سبب الاستثناء مطلوب (5 أحرف على الأقل)';
  END IF;
  INSERT INTO public.data_quality_resolutions (check_code, entity_table, entity_id, resolution, reason, resolved_by)
  VALUES (p_check_code, p_entity_table, p_entity_id, p_resolution, p_reason, auth.uid())
  ON CONFLICT (check_code, entity_table, entity_id)
  DO UPDATE SET resolution = EXCLUDED.resolution, reason = EXCLUDED.reason,
                resolved_by = EXCLUDED.resolved_by, resolved_at = now()
  RETURNING id INTO v_id;
  INSERT INTO public.audit_log (actor_id, actor_role, action, entity_table, entity_id, after_data, context)
  VALUES (auth.uid(), 'admin', 'data_quality_resolve', p_entity_table, p_entity_id,
          jsonb_build_object('check_code', p_check_code, 'resolution', p_resolution, 'reason', p_reason),
          jsonb_build_object('source', 'data_quality'));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_data_quality_finding(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_data_quality_finding(text, text, text, text, text) TO authenticated;

-- 6) Daily snapshot writer (cron / on-demand)
CREATE OR REPLACE FUNCTION public.snapshot_data_quality()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.data_quality_snapshots (check_code, finding_count)
  SELECT f.check_code, COUNT(*)::integer
  FROM public.data_quality_findings_raw f
  WHERE NOT EXISTS (
    SELECT 1 FROM public.data_quality_resolutions r
    WHERE r.check_code = f.check_code AND r.entity_table = f.entity_table AND r.entity_id = f.entity_id
  )
  GROUP BY f.check_code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_data_quality() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_data_quality() TO service_role;

-- 7) Unified audit: backfill unit_audit_log into audit_log (idempotent)
INSERT INTO public.audit_log (created_at, actor_id, actor_email, action, entity_table, entity_id, before_data, after_data, context)
SELECT ual.created_at, ual.performed_by, ual.performed_by_email, ual.action, 'units', ual.unit_id::text,
       jsonb_build_object('status', ual.previous_status),
       jsonb_build_object('status', ual.new_status, 'tenant_snapshot', ual.tenant_snapshot, 'reason', ual.reason),
       jsonb_build_object('migrated_from_unit_audit_log', ual.id)
FROM public.unit_audit_log ual
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_log a
  WHERE a.context ->> 'migrated_from_unit_audit_log' = ual.id::text
);

-- 8) Freeze unit_audit_log: read-only + deprecated marker
REVOKE INSERT, UPDATE, DELETE ON public.unit_audit_log FROM authenticated, anon, service_role;
COMMENT ON TABLE public.unit_audit_log IS 'DEPRECATED: merged into audit_log (migration 0075). Read-only; new unit events go to audit_log.';

-- 9) System audit log browser: server-paginated, admin only
CREATE OR REPLACE FUNCTION public.admin_audit_log_page(
  p_actor_email text DEFAULT NULL, p_entity_table text DEFAULT NULL, p_action text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL,
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 50
) RETURNS TABLE (
  id uuid, created_at timestamptz, actor_email text, actor_role text, action text,
  entity_table text, entity_id text, before_data jsonb, after_data jsonb, total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH filtered AS (
    SELECT a.* FROM public.audit_log a
    WHERE public.has_role(auth.uid(), 'admin')
      AND (p_actor_email IS NULL OR a.actor_email ILIKE '%' || p_actor_email || '%')
      AND (p_entity_table IS NULL OR a.entity_table = p_entity_table)
      AND (p_action IS NULL OR a.action = p_action)
      AND (p_from IS NULL OR a.created_at >= p_from)
      AND (p_to IS NULL OR a.created_at <= p_to)
  )
  SELECT f.id, f.created_at, f.actor_email, f.actor_role, f.action, f.entity_table, f.entity_id,
         f.before_data, f.after_data, (SELECT COUNT(*) FROM filtered) AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 200)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_page_size, 1), 200);
$$;
REVOKE ALL ON FUNCTION public.admin_audit_log_page(text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_audit_log_page(text, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;

-- 10) Verification
DO $$
DECLARE v_resolutions boolean; v_snapshots boolean; v_migrated bigint;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='data_quality_resolutions') INTO v_resolutions;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='data_quality_snapshots') INTO v_snapshots;
  SELECT COUNT(*) INTO v_migrated FROM public.audit_log WHERE context ? 'migrated_from_unit_audit_log';
  IF NOT v_resolutions OR NOT v_snapshots THEN
    RAISE EXCEPTION 'verification failed: data quality tables missing';
  END IF;
  RAISE NOTICE 'verification ok: unit_audit_log rows migrated into audit_log = %', v_migrated;
END;
$$;
