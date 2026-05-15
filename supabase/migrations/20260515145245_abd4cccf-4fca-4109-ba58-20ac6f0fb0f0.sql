-- Telegram alerts on every admin/system change tracked by audit_log
CREATE OR REPLACE FUNCTION public.notify_audit_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payload jsonb;
  _url text := 'https://wqzseofoerwevfebguse.supabase.co/functions/v1/telegram-audit-alert';
  _interesting text[] := ARRAY['bookings','booking_units','invoices','units','tenants','tenant_accounts','tenant_account_units','buildings','user_roles'];
BEGIN
  -- Skip noisy tables
  IF NOT (NEW.entity_table = ANY(_interesting)) THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'table', NEW.entity_table,
    'action', NEW.action,
    'entity_id', NEW.entity_id,
    'actor_email', NEW.actor_email,
    'actor_id', NEW.actor_id,
    'changed', to_jsonb(NEW.changed_fields),
    'before', NEW.before_data,
    'after', NEW.after_data
  );

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-audit-secret', 'aud_9f3kqz7m2x8vp4nrl1bs6h0'
    ),
    body := _payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original operation if Telegram alert fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_telegram_notify ON public.audit_log;
CREATE TRIGGER audit_log_telegram_notify
AFTER INSERT ON public.audit_log
FOR EACH ROW
EXECUTE FUNCTION public.notify_audit_telegram();

-- Make sure invoices changes also get audited (table didn't have audit trigger)
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_tenant_accounts ON public.tenant_accounts;
CREATE TRIGGER audit_tenant_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_tenant_account_units ON public.tenant_account_units;
CREATE TRIGGER audit_tenant_account_units
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_account_units
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();