ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_12h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_4h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;