CREATE OR REPLACE FUNCTION public.guard_unit_available()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'available' THEN
    IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.unit_id = NEW.id) THEN
      RAISE EXCEPTION 'لا يمكن جعل الوحدة % في المبنى % متاحة: عليها مستأجر مسجل. احذف المستأجر أولاً.', NEW.unit_number, NEW.building_number;
    END IF;
    -- Confirmed bookings always create tenant rows (checked above); only pending bookings block here,
    -- so releasing a rented unit by removing its tenant still works.
    IF EXISTS (SELECT 1 FROM public.booking_units bu JOIN public.bookings b ON b.id = bu.booking_id
               WHERE bu.unit_id = NEW.id AND b.status = 'pending') THEN
      RAISE EXCEPTION 'لا يمكن جعل الوحدة % في المبنى % متاحة: عليها حجز قيد الانتظار. ألغِ الحجز أولاً.', NEW.unit_number, NEW.building_number;
    END IF;
  END IF;
  RETURN NEW;
END $function$;