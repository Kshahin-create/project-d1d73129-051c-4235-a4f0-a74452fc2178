DO $$ DECLARE d text;BEGIN SELECT pg_get_functiondef('public.audit_trigger_fn()'::regprocedure) INTO d;IF position('UNIT_STATUS_WRITER_OWNS_AUDIT' IN d)=0 THEN d:=replace(d,'BEGIN
  -- actor email & role from JWT if available','BEGIN
  -- UNIT_STATUS_WRITER_OWNS_AUDIT: status writer emits its own before/after/reason event.
  IF TG_TABLE_NAME = ''units'' AND TG_OP = ''UPDATE'' THEN
    IF NEW.leasing_status IS DISTINCT FROM OLD.leasing_status AND EXISTS (SELECT 1 FROM public.unit_status_write_capabilities WHERE transaction_id=txid_current() AND unit_id=NEW.id) THEN RETURN NEW; END IF;
  END IF;
  -- actor email & role from JWT if available');EXECUTE d;END IF;END $$;
SELECT position('UNIT_STATUS_WRITER_OWNS_AUDIT' IN pg_get_functiondef('public.audit_trigger_fn()'::regprocedure))>0 AS single_status_audit;