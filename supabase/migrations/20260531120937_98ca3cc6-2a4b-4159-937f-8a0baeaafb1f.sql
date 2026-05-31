ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS buildings_sheet_id text,
  ADD COLUMN IF NOT EXISTS buildings_sheet_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS buildings_sheet_last_direction text;