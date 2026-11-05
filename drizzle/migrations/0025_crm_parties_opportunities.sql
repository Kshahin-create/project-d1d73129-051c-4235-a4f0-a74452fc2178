-- Phase 1 Prompt 5 — CRM foundation: parties, opportunities, ownership
-- Additive only. No drops, no deletes.

CREATE TYPE public.party_type AS ENUM ('company', 'individual');
CREATE TYPE public.opportunity_stage AS ENUM ('new', 'contacted', 'qualified', 'offer_sent', 'booking_request', 'on_hold', 'pending_contract', 'won', 'postponed', 'waitlist');
CREATE TYPE public.opportunity_outcome AS ENUM ('no_answer', 'not_interested', 'not_suitable', 'chose_other', 'duplicate');
CREATE TYPE public.opportunity_source AS ENUM ('platform', 'target_list', 'whatsapp', 'call', 'referral', 'campaign', 'walk_in', 'agent');
CREATE TYPE public.opportunity_activity_type AS ENUM ('call', 'whatsapp', 'visit', 'meeting', 'note');
CREATE TYPE public.opportunity_activity_outcome AS ENUM ('answered', 'no_answer', 'follow_up');
CREATE TYPE public.tenant_lifecycle AS ENUM ('active', 'renewal_due', 'renewed', 'ended', 'terminated');

-- Stable, never-reused tenant code counter
CREATE TABLE public.party_code_counter (
  id integer PRIMARY KEY DEFAULT 1,
  next_value bigint NOT NULL DEFAULT 1,
  CONSTRAINT party_code_counter_single_row CHECK (id = 1)
);
INSERT INTO public.party_code_counter (id, next_value) VALUES (1, 1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.party_code_counter TO service_role;

CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code text NOT NULL UNIQUE,
  party_type public.party_type NOT NULL DEFAULT 'individual',
  name_ar text NOT NULL,
  name_en text,
  id_type text,
  id_number text,
  phone text,
  email text,
  city text,
  source text,
  tenant_lifecycle public.tenant_lifecycle,
  merged_into_id uuid REFERENCES public.parties(id),
  archived_at timestamptz,
  archived_by uuid,
  archive_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX parties_identity_unique ON public.parties (id_type, id_number)
  WHERE archived_at IS NULL AND id_type IS NOT NULL AND id_number IS NOT NULL;
CREATE INDEX parties_phone_idx ON public.parties (phone);
GRANT SELECT, INSERT, UPDATE ON public.parties TO authenticated;
GRANT ALL ON public.parties TO service_role;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY parties_select_crm ON public.parties FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY parties_insert_crm ON public.parties FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY parties_update_crm ON public.parties FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER parties_no_delete BEFORE DELETE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();
CREATE TRIGGER parties_updated_at BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.party_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id),
  full_name text NOT NULL,
  role_label text,
  phone text,
  email text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.party_contacts TO authenticated;
GRANT ALL ON public.party_contacts TO service_role;
ALTER TABLE public.party_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY party_contacts_select_crm ON public.party_contacts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY party_contacts_insert_crm ON public.party_contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY party_contacts_update_crm ON public.party_contacts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER party_contacts_no_delete BEFORE DELETE ON public.party_contacts FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id),
  owner_user_id uuid,
  stage public.opportunity_stage NOT NULL DEFAULT 'new',
  outcome public.opportunity_outcome,
  outcome_reason text,
  activity_id uuid REFERENCES public.activities(id),
  area_needed_m2 numeric,
  preferred_unit_ids uuid[],
  source public.opportunity_source NOT NULL DEFAULT 'platform',
  next_action text,
  next_action_at timestamptz,
  no_answer_attempts integer NOT NULL DEFAULT 0,
  lost_to text,
  revisit_at timestamptz,
  notes text,
  booking_id uuid REFERENCES public.bookings(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX opportunities_owner_idx ON public.opportunities (owner_user_id);
CREATE INDEX opportunities_stage_idx ON public.opportunities (stage);
CREATE INDEX opportunities_party_idx ON public.opportunities (party_id);
GRANT SELECT, INSERT, UPDATE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunities_select_crm ON public.opportunities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY opportunities_insert_crm ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY opportunities_update_crm ON public.opportunities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER opportunities_no_delete BEFORE DELETE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();
CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.opportunity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  activity_type public.opportunity_activity_type NOT NULL,
  outcome public.opportunity_activity_outcome NOT NULL,
  notes text,
  next_action text,
  next_action_at timestamptz,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX opportunity_activities_opp_idx ON public.opportunity_activities (opportunity_id);
GRANT SELECT, INSERT ON public.opportunity_activities TO authenticated;
GRANT ALL ON public.opportunity_activities TO service_role;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunity_activities_select_crm ON public.opportunity_activities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'sales_agent'));
CREATE POLICY opportunity_activities_insert_crm ON public.opportunity_activities FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager')
    OR public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER opportunity_activities_no_delete BEFORE DELETE ON public.opportunity_activities FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();
CREATE TRIGGER opportunity_activities_no_update BEFORE UPDATE ON public.opportunity_activities FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

CREATE TABLE public.opportunity_owner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  from_owner uuid,
  to_owner uuid,
  reason text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunity_owner_history TO authenticated;
GRANT ALL ON public.opportunity_owner_history TO service_role;
ALTER TABLE public.opportunity_owner_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunity_owner_history_select_crm ON public.opportunity_owner_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'leasing_manager') OR public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER opportunity_owner_history_no_delete BEFORE DELETE ON public.opportunity_owner_history FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();
CREATE TRIGGER opportunity_owner_history_no_update BEFORE UPDATE ON public.opportunity_owner_history FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

CREATE TABLE public.duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id),
  candidate_party_id uuid REFERENCES public.parties(id),
  match_reason text NOT NULL,
  source_table text,
  source_id uuid,
  status text NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.duplicate_candidates TO authenticated;
GRANT ALL ON public.duplicate_candidates TO service_role;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY duplicate_candidates_select_crm ON public.duplicate_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager'));
CREATE POLICY duplicate_candidates_update_crm ON public.duplicate_candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager'));
CREATE TRIGGER duplicate_candidates_no_delete BEFORE DELETE ON public.duplicate_candidates FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id),
  requested_by uuid NOT NULL,
  current_owner uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transfer_requests TO authenticated;
GRANT ALL ON public.transfer_requests TO service_role;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY transfer_requests_select_crm ON public.transfer_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'leasing_manager'));
CREATE POLICY transfer_requests_insert_agent ON public.transfer_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.has_role(auth.uid(), 'sales_agent'));
CREATE TRIGGER transfer_requests_no_delete BEFORE DELETE ON public.transfer_requests FOR EACH ROW EXECUTE FUNCTION public.block_hard_delete();

CREATE TABLE public.assignment_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_assigned_index integer NOT NULL DEFAULT -1,
  CONSTRAINT assignment_state_single_row CHECK (id = 1)
);
INSERT INTO public.assignment_state (id, last_assigned_index) VALUES (1, -1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.assignment_state TO service_role;

-- Link columns on existing tables (additive)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
ALTER TABLE public.tenant_accounts ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
ALTER TABLE public.customer_profiles ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
ALTER TABLE public.interested_customers ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES public.parties(id);

-- Verification: SELECT count(*) FROM public.parties; SELECT count(*) FROM public.opportunities;