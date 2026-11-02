CREATE OR REPLACE FUNCTION public.guard_unit_available()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'available' THEN
    IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.unit_id = NEW.id) THEN
      RAISE EXCEPTION 'لا يمكن جعل الوحدة % في المبنى % متاحة: عليها مستأجر مسجل. احذف المستأجر أولاً.', NEW.unit_number, NEW.building_number;
    END IF;
    IF EXISTS (SELECT 1 FROM public.booking_units bu JOIN public.bookings b ON b.id = bu.booking_id
               WHERE bu.unit_id = NEW.id AND b.status IN ('pending','confirmed')) THEN
      RAISE EXCEPTION 'لا يمكن جعل الوحدة % في المبنى % متاحة: عليها حجز قائم. ألغِ الحجز أولاً.', NEW.unit_number, NEW.building_number;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS units_guard_available ON public.units;
CREATE TRIGGER units_guard_available BEFORE INSERT OR UPDATE OF status ON public.units
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_available();

CREATE OR REPLACE FUNCTION public.tenant_marks_unit_taken()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.units SET status = 'reserved', updated_at = now()
   WHERE id = NEW.unit_id AND status = 'available';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenants_mark_unit_taken ON public.tenants;
CREATE TRIGGER tenants_mark_unit_taken AFTER INSERT OR UPDATE OF unit_id ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.tenant_marks_unit_taken();

CREATE OR REPLACE FUNCTION public.booking_unit_marks_unit_taken()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = NEW.booking_id AND b.status IN ('pending','confirmed')) THEN
    UPDATE public.units SET status = 'reserved', updated_at = now()
     WHERE id = NEW.unit_id AND status = 'available';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS booking_units_mark_unit_taken ON public.booking_units;
CREATE TRIGGER booking_units_mark_unit_taken AFTER INSERT ON public.booking_units
FOR EACH ROW EXECUTE FUNCTION public.booking_unit_marks_unit_taken();

REVOKE EXECUTE ON FUNCTION public.guard_unit_available() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tenant_marks_unit_taken() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.booking_unit_marks_unit_taken() FROM PUBLIC, anon, authenticated;