-- 1) Restore units from audit_log before_data (use earliest audit row per unit in that batch)
WITH first_audit AS (
  SELECT DISTINCT ON (entity_id)
    entity_id, before_data
  FROM audit_log
  WHERE entity_table='units' AND action='UPDATE'
    AND created_at BETWEEN '2026-05-31 12:04:00' AND '2026-05-31 12:08:00'
  ORDER BY entity_id, created_at ASC
)
UPDATE public.units u
SET unit_type = fa.before_data->>'unit_type',
    area = (fa.before_data->>'area')::numeric,
    activity = fa.before_data->>'activity',
    price = (fa.before_data->>'price')::numeric,
    status = fa.before_data->>'status',
    updated_at = now()
FROM first_audit fa
WHERE u.id = fa.entity_id::uuid;

-- 2) Delete the 65 tenants inserted by the import
DELETE FROM public.tenants t
USING (
  SELECT DISTINCT entity_id FROM audit_log
  WHERE entity_table='tenants' AND action='INSERT'
    AND created_at BETWEEN '2026-05-31 12:04:00' AND '2026-05-31 12:08:00'
) ins
WHERE t.id::text = ins.entity_id;

-- 3) Re-insert the 92 tenants deleted by the import (skip dups defensively)
INSERT INTO public.tenants (
  id, unit_id, tenant_name, business_name, phone, cr_number,
  activity_type, start_date, end_date, notes, offer_image_url, booking_id,
  created_at, updated_at
)
SELECT
  (bd->>'id')::uuid,
  (bd->>'unit_id')::uuid,
  bd->>'tenant_name',
  bd->>'business_name',
  bd->>'phone',
  bd->>'cr_number',
  bd->>'activity_type',
  NULLIF(bd->>'start_date','')::date,
  NULLIF(bd->>'end_date','')::date,
  bd->>'notes',
  bd->>'offer_image_url',
  NULLIF(bd->>'booking_id','')::uuid,
  COALESCE(NULLIF(bd->>'created_at','')::timestamptz, now()),
  now()
FROM (
  SELECT DISTINCT ON (entity_id) entity_id, before_data AS bd
  FROM audit_log
  WHERE entity_table='tenants' AND action='DELETE'
    AND created_at BETWEEN '2026-05-31 12:04:00' AND '2026-05-31 12:08:00'
  ORDER BY entity_id, created_at ASC
) src
ON CONFLICT (id) DO NOTHING;