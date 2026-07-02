DROP POLICY IF EXISTS "Anyone authenticated can insert interested" ON public.interested_customers;
CREATE POLICY "Authenticated users can insert interested"
ON public.interested_customers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND COALESCE(source, 'web') IN ('web','manual','telegram')
);