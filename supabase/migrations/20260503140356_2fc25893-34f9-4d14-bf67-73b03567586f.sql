
CREATE POLICY "Managers view all bookings" ON public.bookings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers view all booking units" ON public.booking_units FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers update bookings" ON public.bookings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers view tenants" ON public.tenants FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers manage tenants" ON public.tenants FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers view customer profiles" ON public.customer_profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers view buildings" ON public.buildings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers update units" ON public.units FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'manager'));
