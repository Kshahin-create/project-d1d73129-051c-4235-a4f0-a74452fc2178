CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'new',
  last_message_at timestamptz,
  last_message_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_phone ON public.leads(phone);

-- Bulk import helper
CREATE OR REPLACE FUNCTION public.import_leads(_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _r jsonb; _n int := 0; _name text; _phone text; _notes text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOR _r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    _name := btrim(COALESCE(_r->>'full_name',''));
    _phone := btrim(COALESCE(_r->>'phone',''));
    _notes := NULLIF(btrim(COALESCE(_r->>'notes','')),'');
    IF _name = '' OR _phone = '' THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.leads WHERE phone = _phone) THEN CONTINUE; END IF;
    INSERT INTO public.leads (full_name, phone, notes, created_by)
    VALUES (_name, _phone, _notes, auth.uid());
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;