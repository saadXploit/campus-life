-- CAMPUS LIFE: Stage 2A - universities, faculties, departments, courses

create type public.university_type as enum ('federal', 'state', 'private');

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (length(name) between 2 and 120),
  short_name text not null check (length(short_name) between 2 and 12),
  type public.university_type not null,
  tagline text not null check (length(tagline) <= 140),
  description text not null check (length(description) <= 1200),
  primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  difficulty smallint not null check (difficulty between 1 and 10),
  reputation smallint not null check (reputation between 1 and 100),
  -- Money is always stored in kobo (whole numbers). 100 kobo = 1 naira.
  tuition_per_semester_kobo bigint not null check (tuition_per_semester_kobo >= 0),
  party_level smallint not null check (party_level between 1 and 10),
  hustle_level smallint not null check (hustle_level between 1 and 10),
  student_population integer not null check (student_population > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.faculties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (university_id, name)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.faculties (id) on delete cascade,
  name text not null check (length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  unique (faculty_id, name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null check (length(name) between 2 and 160),
  code text not null check (length(code) between 2 and 10),
  duration_years smallint not null check (duration_years between 3 and 6),
  -- Entry score needed (0-100). Players must NOT see this directly.
  cutoff_score smallint not null check (cutoff_score between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (department_id, name)
);

-- Row Level Security: players can read, never write.
alter table public.universities enable row level security;
alter table public.faculties enable row level security;
alter table public.departments enable row level security;
alter table public.courses enable row level security;

revoke all on public.universities, public.faculties, public.departments, public.courses
  from anon, authenticated;

grant select on public.universities, public.faculties, public.departments to authenticated;
-- Column-level: players can read everything about a course EXCEPT its cut-off score.
grant select (id, department_id, name, code, duration_years, is_active)
  on public.courses to authenticated;

create policy "universities: players read active"
  on public.universities for select to authenticated
  using (is_active);

create policy "faculties: read for active universities"
  on public.faculties for select to authenticated
  using (exists (
    select 1 from public.universities u
    where u.id = university_id and u.is_active
  ));

create policy "departments: read for active universities"
  on public.departments for select to authenticated
  using (exists (
    select 1 from public.faculties f
    join public.universities u on u.id = f.university_id
    where f.id = faculty_id and u.is_active
  ));

create policy "courses: read active courses of active universities"
  on public.courses for select to authenticated
  using (is_active and exists (
    select 1 from public.departments d
    join public.faculties f on f.id = d.faculty_id
    join public.universities u on u.id = f.university_id
    where d.id = department_id and u.is_active
  ));