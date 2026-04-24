-- Remove public access to sensitive financial data in buildings table
-- Keep units public (as they are listing data) but restrict buildings SELECT to authenticated

-- Drop the overly permissive public SELECT policy on buildings
DROP POLICY IF EXISTS "Anyone can view buildings" ON public.buildings;

-- Create authenticated-only SELECT policy for buildings
CREATE POLICY "Authenticated users can view buildings"
ON public.buildings
FOR SELECT
TO authenticated
USING (true);

-- Note: public (unauthenticated) users can still view units, which is intentional
-- for a public property listing site.