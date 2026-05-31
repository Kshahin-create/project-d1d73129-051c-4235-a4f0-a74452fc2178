
ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS leads_sheet_id text,
  ADD COLUMN IF NOT EXISTS leads_sheet_name text DEFAULT 'Leads',
  ADD COLUMN IF NOT EXISTS leads_sheet_last_sync_at timestamptz;
