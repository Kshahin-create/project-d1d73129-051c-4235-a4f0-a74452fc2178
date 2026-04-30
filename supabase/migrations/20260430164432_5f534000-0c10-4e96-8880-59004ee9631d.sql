ALTER TABLE public.units REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.units;