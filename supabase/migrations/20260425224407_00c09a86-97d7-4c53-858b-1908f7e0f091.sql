-- Re-open units for public browsing (booking flow needs it)
DROP POLICY IF EXISTS "Admins view units" ON public.units;
CREATE POLICY "Anyone can view units"
  ON public.units FOR SELECT
  TO public
  USING (true);

-- Buildings stay admin-only to protect expected_annual_revenue