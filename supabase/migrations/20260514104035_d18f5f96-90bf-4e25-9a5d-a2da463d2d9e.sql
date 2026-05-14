CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own deletion request"
ON public.account_deletion_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own deletion requests"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deletion requests"
ON public.account_deletion_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_account_deletion_requests_user ON public.account_deletion_requests(user_id);
CREATE INDEX idx_account_deletion_requests_status ON public.account_deletion_requests(status);