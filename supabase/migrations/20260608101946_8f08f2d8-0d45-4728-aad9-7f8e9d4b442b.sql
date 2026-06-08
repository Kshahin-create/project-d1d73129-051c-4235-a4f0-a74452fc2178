
-- Explicit deny-all policies for sensitive token tables.
-- Service role bypasses RLS, so backend edge functions keep working.

CREATE POLICY "deny all to clients" ON public.email_otps
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny all to clients" ON public.one_time_tokens
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "deny all to clients" ON public.tenant_login_links
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
