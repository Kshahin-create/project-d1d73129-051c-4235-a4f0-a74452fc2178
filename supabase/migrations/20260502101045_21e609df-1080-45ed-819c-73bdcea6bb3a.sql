REVOKE EXECUTE ON FUNCTION public.verify_api_key(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_api_key(UUID) FROM PUBLIC, anon, authenticated;