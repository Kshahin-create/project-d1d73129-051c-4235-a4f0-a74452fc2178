-- Phase 1 Prompt 5 — automatic opportunity stage sync with bookings and leasing

-- Internal party resolver (no permission checks; used by triggers/backfill only)
CREATE OR REPLACE FUNCTION public.crm_ensure_party(
  _name text, _phone text, _email text, _id_type text, _id_number text, _source text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _existing public.parties;
  _seq bigint;
  _party public.parties;
BEGIN
  IF _id_type IS NOT NULL AND _id_number IS NOT NULL AND length(trim(_id_number)) > 0 THEN
    SELECT * INTO _existing FROM public.parties
    WHERE id_type = _id_type AND id_number = _id_number AND archived_at IS NULL LIMIT 1;
    IF FOUND THEN RETURN _existing.id; END IF;
  END IF;
  IF _phone IS NOT NULL AND length(trim(_phone)) > 0 THEN
    SELECT * INTO _existing FROM public.parties
    WHERE phone = _phone AND archived_at IS NULL LIMIT 1;
    IF FOUND THEN RETURN _existing.id; END IF;
  END IF;
  UPDATE public.party_code_counter SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value - 1 INTO _seq;
  INSERT INTO public.parties (tenant_code, party_type, name_ar, id_type, id_number, phone, email, source)
  VALUES ('T-' || lpad(_seq::text, 6, '0'),
          CASE WHEN _id_type = 'commercial_registration' THEN 'company'::public.party_type ELSE 'individual'::public.party_type END,
          COALESCE(NULLIF(trim(_name), ''), 'بدون اسم'), _id_type, NULLIF(trim(_id_number), ''), _phone, _email, _source)
  RETURNING * INTO _party;
  RETURN _party.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_ensure_party(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Public booking → party + opportunity at booking_request, owner by round-robin
CREATE OR REPLACE FUNCTION public.crm_on_booking_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _party_id uuid;
  _owner uuid;
  _opp_id uuid;
BEGIN
  _party_id := public.crm_ensure_party(NEW.customer_full_name, NEW.customer_phone, NEW.customer_email, NEW.id_type, NEW.cr_number, 'platform');
  UPDATE public.bookings SET party_id = _party_id WHERE id = NEW.id;
  _owner := public.assign_next_agent();
  INSERT INTO public.opportunities (party_id, owner_user_id, stage, source, booking_id, notes)
  VALUES (_party_id, _owner, 'booking_request', 'platform', NEW.id, 'طلب حجز من الموقع العام')
  RETURNING id INTO _opp_id;
  INSERT INTO public.opportunity_owner_history (opportunity_id, from_owner, to_owner, reason)
  VALUES (_opp_id, NULL, _owner, 'توزيع تلقائي بالدور');
  RETURN NEW;
END $$;
CREATE TRIGGER crm_booking_insert_trg AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_booking_insert();

-- Booking status changes move the opportunity; expiry/cancel returns to qualified, never closes
CREATE OR REPLACE FUNCTION public.crm_on_booking_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _opp public.opportunities;
BEGIN
  SELECT * INTO _opp FROM public.opportunities
  WHERE booking_id = NEW.id AND outcome IS NULL ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.status = 'confirmed' AND _opp.stage IN ('booking_request', 'on_hold') THEN
    UPDATE public.opportunities SET stage = 'pending_contract' WHERE id = _opp.id;
  ELSIF NEW.status IN ('expired', 'cancelled') AND _opp.stage IN ('booking_request', 'on_hold', 'pending_contract') THEN
    UPDATE public.opportunities SET stage = 'qualified' WHERE id = _opp.id;
    INSERT INTO public.opportunity_activities (opportunity_id, activity_type, outcome, notes)
    VALUES (_opp.id, 'note', 'follow_up', 'انتهى أو أُلغي الحجز؛ عادت الفرصة إلى «مؤهل»');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_booking_status_trg AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_booking_status();

-- Unit leased → opportunity won + party tenant lifecycle active
CREATE OR REPLACE FUNCTION public.crm_on_unit_leased()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _booking_id uuid;
  _opp public.opportunities;
BEGIN
  IF NEW.leasing_status = 'leased' AND (OLD.leasing_status IS DISTINCT FROM 'leased') THEN
    SELECT booking_id INTO _booking_id FROM public.unit_contracts
    WHERE unit_id = NEW.id AND status = 'active' ORDER BY created_at DESC LIMIT 1;
    IF _booking_id IS NOT NULL THEN
      SELECT * INTO _opp FROM public.opportunities
      WHERE booking_id = _booking_id AND outcome IS NULL ORDER BY created_at DESC LIMIT 1;
      IF FOUND AND _opp.stage <> 'won' THEN
        UPDATE public.opportunities SET stage = 'won', closed_at = now() WHERE id = _opp.id;
        UPDATE public.parties SET tenant_lifecycle = 'active' WHERE id = _opp.party_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_unit_leased_trg AFTER UPDATE OF leasing_status ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_unit_leased();

-- Verification: SELECT tgname FROM pg_trigger WHERE tgname LIKE 'crm_%';