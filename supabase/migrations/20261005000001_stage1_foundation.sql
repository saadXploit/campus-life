-- =====================================================
-- CAMPUS LIFE: Stage 1 foundation
-- Players, identities, staff roles, invites, audit log
-- =====================================================

-- ---------- Types ----------
create type public.staff_role as enum ('OWNER', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR');
create type public.account_status as enum ('active', 'suspended', 'banned');
create type public.staff_status as enum ('active', 'suspended');

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (length(provider) between 1 and 40),
  provider_user_id text not null check (length(provider_user_id) between 1 and 200),
  handle text,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index auth_identities_user_id_idx on public.auth_identities (user_id);

create table public.staff_roles (
  user_id uuid primary key references auth.users (id) on delete restrict,
  role public.staff_role not null,
  status public.staff_status not null default 'active',
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Only ONE owner can ever exist.
create unique index staff_roles_one_owner on public.staff_roles (role) where role = 'OWNER';

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  role public.staff_role not null check (role <> 'OWNER'),
  token_hash text not null unique,
  handle_note text,
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.admin_actions (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_handle text,
  action text not null,
  target_type text,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_actions_created_at_idx on public.admin_actions (created_at desc);

-- ---------- Automatic player profile on first login ----------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- OWNER protection ----------
create function public.protect_owner_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'OWNER' then
      raise exception 'The OWNER role cannot be deleted';
    end if;
    return old;
  end if;

  if old.role = 'OWNER' and (
    new.role <> 'OWNER' or new.status <> 'active' or new.user_id <> old.user_id
  ) then
    raise exception 'The OWNER cannot be demoted, suspended or reassigned';
  end if;

  if new.role = 'OWNER' and old.role <> 'OWNER' then
    raise exception 'OWNER can only be created by the secure owner setup';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger staff_roles_protect_owner
  before update or delete on public.staff_roles
  for each row execute function public.protect_owner_role();

create function public.protect_owner_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'active' and exists (
    select 1 from public.staff_roles
    where user_id = new.id and role = 'OWNER'
  ) then
    raise exception 'The OWNER account cannot be suspended or banned';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_owner
  before update on public.profiles
  for each row execute function public.protect_owner_profile();

-- ---------- Audit log is append-only ----------
create function public.admin_actions_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin_actions is append-only';
end;
$$;

create trigger admin_actions_no_change
  before update or delete on public.admin_actions
  for each row execute function public.admin_actions_append_only();

create trigger admin_actions_no_truncate
  before truncate on public.admin_actions
  for each statement execute function public.admin_actions_append_only();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.auth_identities enable row level security;
alter table public.staff_roles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.admin_actions enable row level security;

-- Browsers/players: no access by default.
revoke all on public.profiles from anon, authenticated;
revoke all on public.auth_identities from anon, authenticated;
revoke all on public.staff_roles from anon, authenticated;
revoke all on public.staff_invites from anon, authenticated;
revoke all on public.admin_actions from anon, authenticated;

-- A signed-in player may only READ their own profile and identities.
grant select on public.profiles to authenticated;
grant select on public.auth_identities to authenticated;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "identities: read own"
  on public.auth_identities for select to authenticated
  using ((select auth.uid()) = user_id);

-- staff_roles, staff_invites, admin_actions: no policies at all.
-- Only our trusted server (secret key) can touch them.