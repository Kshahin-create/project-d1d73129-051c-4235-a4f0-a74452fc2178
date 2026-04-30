ALTER TABLE public.units DROP CONSTRAINT units_status_check;
ALTER TABLE public.units ADD CONSTRAINT units_status_check CHECK (status = ANY (ARRAY['available'::text, 'rented'::text, 'reserved'::text]));

UPDATE public.units SET status='available';
UPDATE public.units SET status='reserved' WHERE (building_number, unit_number) IN ((1,399),(1,404),(1,405),(1,406),(1,410),(1,411),(1,422),(2,352),(2,354),(2,363),(2,364),(3,303),(3,304),(3,305),(3,314),(3,315),(3,316),(3,317),(3,326),(5,207),(5,208),(5,219),(5,220),(7,76),(7,77),(10,140),(10,150),(10,151),(10,152),(10,153),(10,157));
UPDATE public.units SET status='rented' WHERE (building_number, unit_number) IN ((2,351));