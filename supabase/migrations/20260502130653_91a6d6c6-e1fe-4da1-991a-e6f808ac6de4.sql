-- جدول لتخزين أكواد OTP بشكل آمن
CREATE TABLE IF NOT EXISTS public.email_otps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login', -- login | signup
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON public.email_otps (lower(email));
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON public.email_otps (expires_at);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- لا نسمح لأي مستخدم client بالوصول؛ كل العمليات تتم فقط عبر edge functions باستخدام service role
-- (RLS مفعل بدون policies = منع كامل من جانب العميل)
