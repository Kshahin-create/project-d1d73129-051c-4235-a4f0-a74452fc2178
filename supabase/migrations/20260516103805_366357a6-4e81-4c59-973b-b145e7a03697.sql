CREATE TABLE IF NOT EXISTS public.telegram_chat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tg_mem_chat_created ON public.telegram_chat_memory(chat_id, created_at DESC);
ALTER TABLE public.telegram_chat_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view chat memory" ON public.telegram_chat_memory FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));