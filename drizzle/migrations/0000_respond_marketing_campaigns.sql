CREATE TABLE public.marketing_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL, name text NOT NULL, template_name text NOT NULL, language text NOT NULL, channel_id bigint NOT NULL, components jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'paused' CHECK (status IN ('paused','running','completed')), audience_summary jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_campaigns_admin_read ON public.marketing_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.marketing_recipients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE, phone text NOT NULL, sources text[] NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','accepted','failed','unknown')), provider_response jsonb, error text, attempted_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id, phone)
);
GRANT SELECT ON public.marketing_recipients TO authenticated;
GRANT ALL ON public.marketing_recipients TO service_role;
ALTER TABLE public.marketing_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_recipients_admin_read ON public.marketing_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX marketing_recipients_queue ON public.marketing_recipients(campaign_id,status);
CREATE FUNCTION public.claim_marketing_recipient(_campaign_id uuid) RETURNS SETOF public.marketing_recipients LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.marketing_recipients SET status='sending',attempted_at=now(),updated_at=now() WHERE id IN (
 SELECT r.id FROM public.marketing_recipients r JOIN public.marketing_campaigns c ON c.id=r.campaign_id WHERE r.campaign_id=_campaign_id AND r.status='queued' AND c.status='running' ORDER BY r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1
 ) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_marketing_recipient(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_marketing_recipient(uuid) TO service_role;