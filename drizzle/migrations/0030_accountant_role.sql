ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
SELECT enumlabel FROM pg_enum WHERE enumtypid='public.app_role'::regtype AND enumlabel='accountant';