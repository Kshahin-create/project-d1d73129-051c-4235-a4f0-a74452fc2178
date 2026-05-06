CREATE TABLE public.one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  next_path text NOT NULL DEFAULT '/dashboard',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ott_token_hash ON public.one_time_tokens(token_hash);
CREATE INDEX idx_ott_expires_at ON public.one_time_tokens(expires_at);

ALTER TABLE public.one_time_tokens ENABLE ROW LEVEL SECURITY;

-- No policies: only service role can access (bypasses RLS)
