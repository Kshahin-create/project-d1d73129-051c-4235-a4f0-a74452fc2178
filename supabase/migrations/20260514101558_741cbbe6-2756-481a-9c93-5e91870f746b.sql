
DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated','authenticated',
    'googleplay.review@mnicejar.com',
    crypt('GooglePlay@2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Google Play Reviewer"}'::jsonb,
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), new_user_id,
    jsonb_build_object('sub', new_user_id::text, 'email','googleplay.review@mnicejar.com','email_verified',true),
    'email', new_user_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (new_user_id, 'Google Play Reviewer', 'googleplay.review@mnicejar.com')
  ON CONFLICT DO NOTHING;
END $$;
