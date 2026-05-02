-- API Keys table for external integrations (mobile app, third-party systems)
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,          -- first 8 chars shown in UI (e.g. "nkb_live")
  key_hash TEXT NOT NULL UNIQUE,     -- sha256 hex of the full key
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],  -- 'read', 'write', 'admin'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active = true;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage api keys (full content never reaches them anyway after creation)
CREATE POLICY "Admins view api keys"
ON public.api_keys FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert api keys"
ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update api keys"
ON public.api_keys FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete api keys"
ON public.api_keys FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to verify an api key (called only from service-role edge function)
CREATE OR REPLACE FUNCTION public.verify_api_key(_key_hash TEXT)
RETURNS TABLE(id UUID, scopes TEXT[], is_valid BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    k.id,
    k.scopes,
    (k.is_active AND (k.expires_at IS NULL OR k.expires_at > now())) AS is_valid
  FROM public.api_keys k
  WHERE k.key_hash = _key_hash
  LIMIT 1;
$$;

-- Function to update last_used_at without RLS interference
CREATE OR REPLACE FUNCTION public.touch_api_key(_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.api_keys SET last_used_at = now() WHERE id = _id;
$$;