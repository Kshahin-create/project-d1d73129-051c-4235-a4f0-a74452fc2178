CREATE OR REPLACE FUNCTION public.metrics_legacy_finance(_scope jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb:=coalesce(_scope,'{}'); unscoped boolean; f date; t date; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.finance_can_read() OR public.has_role(auth.uid(),'investor')) THEN RAISE EXCEPTION 'البيانات المالية غير مسموحة لدورك'; END IF;
 IF jsonb_typeof(s)<>'object' OR octet_length(s::text)>16000 THEN RAISE EXCEPTION 'نطاق غير صالح'; END IF;
 f:=coalesce(nullif(s->>'from','')::date,date_trunc('month',now() AT TIME ZONE 'Asia/Riyadh')::date);
 t:=coalesce(nullif(s->>'to','')::date,(now() AT TIME ZONE 'Asia/Riyadh')::date);
 IF f>t THEN RAISE EXCEPTION 'فترة غير صالحة'; END IF;
 unscoped:=nullif(s->>'building','') IS NULL AND nullif(s->>'phase','') IS NULL AND nullif(s->>'activity','') IS NULL AND nullif(s->>'unit_type','') IS NULL AND nullif(s->>'publish_state','') IS NULL;
 WITH su AS (SELECT u.id FROM public.metrics_unit_scope u WHERE public.metrics_scope_match(u,s)),
 c AS (SELECT c.amount,c.created_at FROM public.unit_collections c WHERE NOT c.is_archived AND c.archived_at IS NULL AND (unscoped OR c.unit_id IN (SELECT id FROM su))),
 i AS (SELECT i.amount,i.paid_amount,i.reverses_id FROM public.invoices i WHERE i.archived_at IS NULL AND (unscoped OR i.unit_id IN (SELECT id FROM su))),
 leased AS (SELECT u.id FROM public.metrics_unit_scope u WHERE public.metrics_scope_match(u,s) AND u.leasing_status='leased'),
 r AS (SELECT r.* FROM public.receipts r WHERE r.archived_at IS NULL AND r.reverses_id IS NULL AND r.status='recorded')
 SELECT jsonb_build_object(
  'as_of',now(),'period',jsonb_build_object('from',f,'to',t),'vat_basis','excl_vat_confirmed',
  'collections_count',(SELECT count(*) FROM c),
  'collections_excl',round(coalesce((SELECT sum(amount) FROM c),0),2),
  'collections_period_count',(SELECT count(*) FROM c WHERE created_at>=(f::timestamp AT TIME ZONE 'Asia/Riyadh') AND created_at<((t+1)::timestamp AT TIME ZONE 'Asia/Riyadh')),
  'collections_period_excl',round(coalesce((SELECT sum(amount) FROM c WHERE created_at>=(f::timestamp AT TIME ZONE 'Asia/Riyadh') AND created_at<((t+1)::timestamp AT TIME ZONE 'Asia/Riyadh')),0),2),
  'invoices_count',(SELECT count(*) FROM i WHERE reverses_id IS NULL),
  'invoices_excl',round(coalesce((SELECT sum(amount) FROM i),0),2),
  'invoices_paid_excl',round(coalesce((SELECT sum(coalesce(paid_amount,0)) FROM i),0),2),
  'invoices_remaining_excl',round(coalesce((SELECT sum(greatest(amount-coalesce(paid_amount,0),0)) FROM i WHERE reverses_id IS NULL),0),2),
  'leased_without_contract',(SELECT count(*) FROM leased l WHERE NOT EXISTS(SELECT 1 FROM public.contract_units cu JOIN public.contracts k ON k.id=cu.contract_id WHERE cu.unit_id=l.id AND k.status='active')),
  'receipts_recorded',CASE WHEN unscoped THEN (SELECT count(*) FROM r) END,
  'receipts_without_paid_at',CASE WHEN unscoped THEN (SELECT count(*) FROM r WHERE r.paid_at IS NULL) END,
  'legacy_sources_review',CASE WHEN unscoped THEN (SELECT count(*) FROM public.receipt_legacy_sources WHERE resolution='review') END
 ) INTO result;
 RETURN result;
END $$;
COMMENT ON FUNCTION public.metrics_legacy_finance(jsonb) IS 'Read-only, clearly labelled legacy (pre-cutover) finance aggregates; never merged into metrics_finance definitions.';
REVOKE ALL ON FUNCTION public.metrics_legacy_finance(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.metrics_legacy_finance(jsonb) TO authenticated;
SELECT to_regprocedure('public.metrics_legacy_finance(jsonb)') IS NOT NULL AS legacy_finance_ready;