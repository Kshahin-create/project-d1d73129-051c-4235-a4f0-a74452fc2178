-- 1) Generic audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text NOT NULL, -- INSERT | UPDATE | DELETE
  entity_table text NOT NULL,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[],
  ip_address text,
  user_agent text,
  context jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(entity_table);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_table, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view audit_log" ON public.audit_log;
CREATE POLICY "Admins view audit_log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies → only triggers (SECURITY DEFINER) and service_role can write.

-- 2) Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_role text;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := ARRAY[]::text[];
  v_entity_id text;
  k text;
  v_request_headers jsonb;
  v_ip text;
  v_ua text;
BEGIN
  -- actor email & role from JWT if available
  BEGIN
    v_email := COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'email', NULL);
    v_role  := COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', NULL);
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL; v_role := NULL;
  END;

  -- request headers (ip, ua) if available
  BEGIN
    v_request_headers := current_setting('request.headers', true)::jsonb;
    v_ip := COALESCE(v_request_headers ->> 'x-forwarded-for', v_request_headers ->> 'x-real-ip');
    v_ua := v_request_headers ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL; v_ua := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_after := to_jsonb(NEW);
    v_entity_id := COALESCE(v_after ->> 'id', '');
  ELSIF (TG_OP = 'UPDATE') THEN
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_entity_id := COALESCE(v_after ->> 'id', v_before ->> 'id', '');
    -- compute changed fields
    FOR k IN SELECT jsonb_object_keys(v_after) LOOP
      IF (v_before -> k) IS DISTINCT FROM (v_after -> k) THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    -- skip noise: only updated_at changed
    IF array_length(v_changed, 1) IS NULL OR (array_length(v_changed,1) = 1 AND v_changed[1] = 'updated_at') THEN
      RETURN NEW;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_before := to_jsonb(OLD);
    v_entity_id := COALESCE(v_before ->> 'id', '');
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_email, actor_role,
    action, entity_table, entity_id,
    before_data, after_data, changed_fields,
    ip_address, user_agent
  ) VALUES (
    v_actor, v_email, v_role,
    TG_OP, TG_TABLE_NAME, v_entity_id,
    v_before, v_after, NULLIF(v_changed, ARRAY[]::text[]),
    v_ip, v_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Attach triggers to all important tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'units','buildings','tenants',
    'bookings','booking_units',
    'user_roles','profiles',
    'api_keys','customer_profiles'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I;', t, t);
    EXECUTE format(
      'CREATE TRIGGER audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();',
      t, t
    );
  END LOOP;
END $$;