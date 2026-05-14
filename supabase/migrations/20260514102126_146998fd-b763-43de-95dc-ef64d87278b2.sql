
CREATE OR REPLACE FUNCTION public.lookup_login_email(_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id text := btrim(COALESCE(_identifier, ''));
  _email text;
  _digits text;
BEGIN
  IF _id = '' THEN RETURN NULL; END IF;

  -- Email exact (case-insensitive)
  IF position('@' in _id) > 0 THEN
    SELECT p.email INTO _email
    FROM public.profiles p
    WHERE lower(p.email) = lower(_id)
    LIMIT 1;
    IF _email IS NOT NULL THEN RETURN _email; END IF;
    -- maybe it's already the auth email but no profile
    SELECT u.email INTO _email FROM auth.users u WHERE lower(u.email) = lower(_id) LIMIT 1;
    RETURN _email;
  END IF;

  -- Phone: digits only
  _digits := regexp_replace(_id, '\D', '', 'g');
  IF length(_digits) >= 8 THEN
    IF left(_digits, 2) = '00' THEN _digits := substring(_digits from 3); END IF;
    IF left(_digits, 1) = '0' AND length(_digits) = 10 THEN
      _digits := '966' || substring(_digits from 2);
    END IF;
    -- alias email pattern used by signup
    SELECT u.email INTO _email
    FROM auth.users u
    WHERE u.email = (_digits || '@phone.mnicity.app')
       OR u.phone = _digits
    LIMIT 1;
    IF _email IS NOT NULL THEN RETURN _email; END IF;
  END IF;

  -- Username / display name (case-insensitive exact)
  SELECT p.email INTO _email
  FROM public.profiles p
  WHERE lower(btrim(p.display_name)) = lower(_id)
  LIMIT 1;
  RETURN _email;
END; $$;

GRANT EXECUTE ON FUNCTION public.lookup_login_email(text) TO anon, authenticated;
