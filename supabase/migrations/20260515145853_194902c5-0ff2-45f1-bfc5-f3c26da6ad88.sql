-- Telegram subscribers (per-admin notification routing)
CREATE TABLE IF NOT EXISTS public.telegram_subscribers (
  chat_id bigint PRIMARY KEY,
  user_id uuid,
  display_name text,
  subscriptions text[] NOT NULL DEFAULT ARRAY['booking','invoice','unit','tenant','daily_summary','expiry','overdue','anomaly']::text[],
  muted_until timestamptz,
  is_admin boolean NOT NULL DEFAULT false,
  last_referenced_invoice_id uuid,
  last_referenced_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage telegram subscribers" ON public.telegram_subscribers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users view own telegram subscriber" ON public.telegram_subscribers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_tg_subscribers_updated_at BEFORE UPDATE ON public.telegram_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link tokens (admin generates a token, then sends /start <token> to bot)
CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz,
  used_by_chat_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own link tokens" ON public.telegram_link_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Receipt image on invoice
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS receipt_image_url text;

-- Tenant contract end date (for expiry alerts)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS end_date date;

-- Helper RPC: create a one-time link token for the calling user
CREATE OR REPLACE FUNCTION public.create_telegram_link_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  _t := encode(gen_random_bytes(12), 'hex');
  INSERT INTO public.telegram_link_tokens (token, user_id) VALUES (_t, auth.uid());
  RETURN _t;
END; $$;

-- Helper RPC: list my telegram links (returns current subscriber rows for this user)
CREATE OR REPLACE FUNCTION public.list_my_telegram_links()
RETURNS TABLE(chat_id bigint, display_name text, subscriptions text[], muted_until timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT chat_id, display_name, subscriptions, muted_until, created_at
  FROM public.telegram_subscribers WHERE user_id = auth.uid();
$$;

-- Helper RPC: unlink one of my chats
CREATE OR REPLACE FUNCTION public.unlink_my_telegram(_chat_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.telegram_subscribers WHERE chat_id = _chat_id AND user_id = auth.uid();
END; $$;