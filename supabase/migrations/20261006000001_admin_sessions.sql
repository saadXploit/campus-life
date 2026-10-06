alter table public.staff_roles
  add column if not exists sessions_valid_after timestamptz not null default 'epoch';