create table if not exists public.access_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  phone text,
  email text,
  event text not null,
  ip_address text,
  country text,
  region text,
  city text,
  isp text,
  user_agent text,
  path text,
  created_at timestamptz not null default now()
);

grant select on public.access_log to authenticated;
grant all on public.access_log to service_role;

alter table public.access_log enable row level security;

drop policy if exists "admins read access log" on public.access_log;
create policy "admins read access log" on public.access_log
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'));

create index if not exists access_log_created_idx on public.access_log (created_at desc);
create index if not exists access_log_ip_idx on public.access_log (ip_address);
create index if not exists access_log_user_idx on public.access_log (user_id);