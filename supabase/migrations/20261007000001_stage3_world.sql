-- CAMPUS LIFE: Stage 3A - world data

create table public.world_clock (
  id boolean primary key default true check (id),
  epoch timestamptz not null default now(),
  day_length_minutes integer not null default 20 check (day_length_minutes between 1 and 1440),
  day_start_hour smallint not null default 6 check (day_start_hour between 0 and 12),
  hours_per_day smallint not null default 16 check (hours_per_day between 8 and 20)
);
insert into public.world_clock default values;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (length(name) between 2 and 60),
  kind text not null check (kind in
    ('hostel','faculty','library','cafeteria','market','sports','clubhouse','health')),
  description text not null check (length(description) <= 300),
  map_x smallint not null check (map_x between 0 and 100),
  map_y smallint not null check (map_y between 0 and 100),
  has_billboard boolean not null default false,
  unique (university_id, slug),
  unique (university_id, kind)
);

create table public.activities (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (length(name) between 2 and 60),
  description text not null check (length(description) <= 200),
  location_kind text not null check (location_kind in
    ('hostel','faculty','library','cafeteria','market','sports','clubhouse','health')),
  duration_hours numeric(4,2) not null check (duration_hours > 0 and duration_hours <= 12),
  energy_delta smallint not null check (energy_delta between -100 and 100),
  health_delta smallint not null check (health_delta between -100 and 100),
  happiness_delta smallint not null check (happiness_delta between -100 and 100),
  cost_kobo bigint not null default 0 check (cost_kobo >= 0),
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.accommodation_types (
  slug text primary key check (slug ~ '^[a-z-]{2,40}$'),
  name text not null,
  description text not null check (length(description) <= 300),
  comfort smallint not null check (comfort between 1 and 10),
  security smallint not null check (security between 1 and 10),
  social smallint not null check (social between 1 and 10),
  beds_per_room smallint not null check (beds_per_room between 1 and 8),
  extra_travel_hours numeric(3,2) not null default 0 check (extra_travel_hours between 0 and 3),
  sleep_bonus smallint not null default 0 check (sleep_bonus between 0 and 30),
  sort_order smallint not null default 0
);

create table public.university_accommodations (
  university_id uuid not null references public.universities (id) on delete cascade,
  accommodation_slug text not null references public.accommodation_types (slug),
  rent_per_semester_kobo bigint not null check (rent_per_semester_kobo >= 0),
  primary key (university_id, accommodation_slug)
);

create table public.player_state (
  player_id uuid primary key references public.players (id) on delete cascade,
  location_id uuid references public.locations (id),
  energy smallint not null default 80 check (energy between 0 and 100),
  health smallint not null default 90 check (health between 0 and 100),
  happiness smallint not null default 75 check (happiness between 0 and 100),
  day_number integer not null default 0,
  hours_left numeric(4,2) not null default 0 check (hours_left >= 0 and hours_left <= 24),
  slept_today boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security: players can read, never write.
alter table public.world_clock enable row level security;
alter table public.locations enable row level security;
alter table public.activities enable row level security;
alter table public.accommodation_types enable row level security;
alter table public.university_accommodations enable row level security;
alter table public.player_state enable row level security;

revoke all on public.world_clock, public.locations, public.activities,
  public.accommodation_types, public.university_accommodations, public.player_state
  from anon, authenticated;
grant select on public.world_clock, public.locations, public.activities,
  public.accommodation_types, public.university_accommodations, public.player_state
  to authenticated;

create policy "world_clock: read" on public.world_clock
  for select to authenticated using (true);

create policy "locations: read for active universities" on public.locations
  for select to authenticated using (exists (
    select 1 from public.universities u where u.id = university_id and u.is_active));

create policy "activities: read active" on public.activities
  for select to authenticated using (is_active);

create policy "accommodation_types: read" on public.accommodation_types
  for select to authenticated using (true);

create policy "university_accommodations: read for active universities"
  on public.university_accommodations
  for select to authenticated using (exists (
    select 1 from public.universities u where u.id = university_id and u.is_active));

create policy "player_state: read own" on public.player_state
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.id = player_id and p.user_id = (select auth.uid())));

-- Campus locations (State is mirrored left-right, Private is flipped top-bottom)
with t (name, kind, descr, x, y, billboard) as (
  values
    ('Hostel Area', 'hostel', 'Where the late-night gist happens and the generator never rests.', 15, 70, false),
    ('Faculty Block', 'faculty', 'Lecture halls, notice boards and the steps where coursemates plot.', 50, 30, false),
    ('Library', 'library', 'Quiet corners, cold air-conditioning and a seat nobody wants to give up.', 75, 25, false),
    ('Cafeteria', 'cafeteria', 'Steaming pots, long queues and the best jollof depends on who you ask.', 40, 60, false),
    ('Market Gate', 'market', 'Hawkers, street food and a thousand small hustles at the main gate.', 85, 75, true),
    ('Sports Field', 'sports', 'Evening football, morning runs and the loudest cheering on campus.', 20, 25, true),
    ('Club House', 'clubhouse', 'Music, lights and the place everybody pretends not to be seen.', 62, 52, true),
    ('Health Centre', 'health', 'Small, busy and always smelling of disinfectant.', 45, 85, false)
)
insert into public.locations
  (university_id, slug, name, kind, description, map_x, map_y, has_billboard)
select u.id, lower(replace(t.name, ' ', '-')), t.name, t.kind, t.descr,
  case u.type when 'state' then 100 - t.x else t.x end,
  case u.type when 'private' then 100 - t.y else t.y end,
  t.billboard
from public.universities u cross join t;

-- Activities (costs in kobo: 100 kobo = 1 naira)
insert into public.activities
  (slug, name, description, location_kind, duration_hours,
   energy_delta, health_delta, happiness_delta, cost_kobo, sort_order)
values
  ('sleep', 'Sleep', 'A full night of rest.', 'hostel', 8, 70, 3, 2, 0, 1),
  ('nap', 'Take a nap', 'A short rest between the chaos.', 'hostel', 2, 20, 0, 1, 0, 2),
  ('hang_out_hostel', 'Hang out in the hostel', 'Gist, music and stolen snacks.', 'hostel', 2, -3, 0, 4, 0, 3),
  ('bread_and_tea', 'Bread and tea', 'Cheap, quick and filling enough.', 'hostel', 0.5, 6, 0, 0, 15000, 4),
  ('cafeteria_meal', 'Cafeteria meal', 'A proper plate of food.', 'cafeteria', 1, 15, 2, 2, 50000, 5),
  ('street_food', 'Street food', 'Hot, spicy and slightly risky.', 'market', 1, 10, -1, 3, 30000, 6),
  ('snacks', 'Buy snacks', 'Something small to keep going.', 'market', 0.5, 4, 0, 2, 15000, 7),
  ('window_shopping', 'Window shopping', 'Walk the stalls and dream big.', 'market', 1, -3, 0, 2, 0, 8),
  ('pickup_football', 'Pickup football', 'Evening match on the field.', 'sports', 2, -12, 3, 6, 0, 9),
  ('light_workout', 'Light workout', 'A quick run and some push-ups.', 'sports', 1, -10, 4, 2, 0, 10),
  ('clubhouse_hangout', 'Hang out at the Club House', 'Good music, good company, small cover charge.', 'clubhouse', 2, -5, 0, 8, 80000, 11),
  ('health_checkup', 'Health check-up', 'A quick visit to keep you in shape.', 'health', 1, 0, 10, 0, 100000, 12),
  ('quiet_reading', 'Quiet reading', 'A peaceful couple of hours with a book.', 'library', 2, -4, 0, 3, 0, 13),
  ('faculty_gist', 'Gist with coursemates', 'Compare notes and complain together.', 'faculty', 1, -2, 0, 3, 0, 14);

-- Accommodation types
insert into public.accommodation_types
  (slug, name, description, comfort, security, social, beds_per_room,
   extra_travel_hours, sleep_bonus, sort_order)
values
  ('hostel-shared', 'Shared Hostel', 'Four to a room, thin walls, endless gist. Cheapest and loudest.', 3, 5, 8, 4, 0, 0, 1),
  ('shared-apartment', 'Shared Apartment', 'Two to a room with a small kitchen. Quieter and a little pricier.', 6, 6, 6, 2, 0.25, 5, 2),
  ('private-room', 'Private Room', 'Your own door and your own sleep. Costs more, and the social life is up to you.', 8, 7, 4, 1, 0.25, 10, 3),
  ('off-campus', 'Off-Campus Lodge', 'Cheaper than it looks, but the walk to campus eats into your day.', 5, 4, 5, 2, 1.00, 3, 4);

-- Rent per university: Federal x1.0, State x1.3, Private x2.0
insert into public.university_accommodations (university_id, accommodation_slug, rent_per_semester_kobo)
select u.id, a.slug,
  a.base * (case u.type when 'state' then 13 when 'private' then 20 else 10 end) / 10
from public.universities u
cross join (values
  ('hostel-shared', 600000::bigint),
  ('shared-apartment', 1500000::bigint),
  ('private-room', 3000000::bigint),
  ('off-campus', 2000000::bigint)
) as a (slug, base);