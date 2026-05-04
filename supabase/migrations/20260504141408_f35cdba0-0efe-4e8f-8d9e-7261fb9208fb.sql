CREATE TABLE IF NOT EXISTS public.phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup','reset')),
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON public.phone_otps(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otps_created ON public.phone_otps(created_at);

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (edge functions) can access.
CREATE POLICY "deny all to anon"
ON public.phone_otps
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);