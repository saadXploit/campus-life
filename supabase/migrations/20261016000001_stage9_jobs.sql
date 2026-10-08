-- CAMPUS LIFE: Stage 9 - jobs
-- Players pick a job, meet the boss (a staff character, never a real player) at the
-- workplace, and work real-time shifts. Pay arrives when the shift ends.
-- Safe to run more than once.

insert into public.app_config (key, value) values
  ('job_pay_percent', '100'),
  ('job_daily_shifts', '3'),
  ('job_change_hours', '24')
on conflict (key) do nothing;

-- ---------- The jobs on every campus ----------

create table if not exists public.jobs (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (length(name) between 2 and 60),
  description text not null check (length(description) <= 200),
  location_kind text not null check (location_kind in
    ('hostel','faculty','library','cafeteria','market','sports','clubhouse','health')),
  boss_name text not null check (length(boss_name) between 2 and 40),
  boss_title text not null check (length(boss_title) between 2 and 40),
  pay_kobo bigint not null check (pay_kobo between 0 and 100000000),
  shift_minutes integer not null check (shift_minutes between 10 and 480),
  energy_cost smallint not null check (energy_cost between 0 and 100),
  happiness_delta smallint not null default 0 check (happiness_delta between -20 and 20),
  -- Working hours in Nigerian time. A closing hour at or before the opening hour runs past midnight.
  open_hour smallint not null check (open_hour between 0 and 23),
  close_hour smallint not null check (close_hour between 0 and 24),
  min_level smallint not null default 1 check (min_level between 1 and 7),
  min_cgpa numeric(3, 2) check (min_cgpa between 0 and 5),
  min_age smallint not null default 16 check (min_age between 16 and 30),
  is_active boolean not null default true,
  sort_order smallint not null default 0
);
alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;

insert into public.jobs
  (slug, name, description, location_kind, boss_name, boss_title, pay_kobo, shift_minutes,
   energy_cost, happiness_delta, open_hour, close_hour, min_level, min_cgpa, min_age, sort_order)
values
  ('hostel_errands', 'Hostel errand runner', 'Buy recharge cards, carry buckets and deliver food for the hall.',
   'hostel', 'Baba Sule', 'Hall Porter', 500000, 45, 10, 0, 6, 22, 1, null, 16, 1),
  ('cafeteria_server', 'Cafeteria server', 'Dish out jollof, wash plates and keep the queue moving.',
   'cafeteria', 'Mama Nkechi', 'Cafeteria Manager', 500000, 60, 12, 0, 7, 20, 1, null, 16, 2),
  ('library_assistant', 'Library assistant', 'Shelve books, stamp cards and keep the reading room quiet.',
   'library', 'Mr. Okon', 'Chief Librarian', 500000, 60, 8, 0, 8, 18, 1, null, 16, 3),
  ('pos_agent', 'POS agent', 'Run a POS stand at the gate: withdrawals, transfers and airtime.',
   'market', 'Alhaji Musa', 'POS Business Owner', 1000000, 90, 15, 0, 8, 21, 1, null, 16, 4),
  ('fitness_coach', 'Fitness coach assistant', 'Lead warm-ups and drills for the evening fitness crowd.',
   'sports', 'Coach Emeka', 'Head Coach', 1000000, 90, 22, 2, 6, 19, 1, null, 16, 5),
  ('campus_tutor', 'Campus tutor', 'Teach tutorial classes for younger students. Top grades only.',
   'faculty', 'Dr. Funmi Adebayo', 'Tutorial Centre Director', 2000000, 120, 18, 0, 9, 19, 1, 3.50, 16, 6),
  ('club_bartender', 'Club bartender', 'Mix drinks and keep the bar running on busy nights. 18+ only.',
   'clubhouse', 'Big Tunde', 'Club Manager', 2000000, 120, 25, -2, 18, 2, 1, null, 18, 7),
  ('pharmacy_attendant', 'Pharmacy attendant', 'Hand out prescriptions and keep records at the health centre. 200 level and above.',
   'health', 'Nurse Bisi', 'Chief Nursing Officer', 2000000, 120, 18, 0, 8, 18, 2, null, 16, 8)
on conflict (slug) do nothing;

-- Each player's current job (one at a time).
create table if not exists public.player_jobs (
  player_id uuid primary key references public.players (id) on delete cascade,
  job_slug text references public.jobs (slug),
  shifts_done integer not null default 0 check (shifts_done >= 0),
  hired_at timestamptz,
  changed_at timestamptz not null default now()
);
alter table public.player_jobs enable row level security;
revoke all on public.player_jobs from anon, authenticated;

-- Every shift worked. Pay is fixed when the shift starts and paid when it ends.
create table if not exists public.work_shifts (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  job_slug text not null references public.jobs (slug),
  work_day date not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  pay_kobo bigint not null check (pay_kobo >= 0),
  bonus_kobo bigint not null default 0 check (bonus_kobo >= 0),
  boss_line text check (length(boss_line) <= 200),
  paid_at timestamptz
);
alter table public.work_shifts enable row level security;
revoke all on public.work_shifts from anon, authenticated;
create index if not exists work_shifts_day_idx on public.work_shifts (player_id, work_day);
create index if not exists work_shifts_recent_idx on public.work_shifts (player_id, id desc);
create index if not exists work_shifts_unpaid_idx on public.work_shifts (player_id) where paid_at is null;

-- ---------- Helpers ----------

create or replace function public.job_open(p_open int, p_close int, p_hour int)
returns boolean
language sql immutable set search_path = ''
as $$
  select case when p_close > p_open then p_hour >= p_open and p_hour < p_close
              else p_hour >= p_open or p_hour < p_close end
$$;

-- 1 = Trainee (first 10 shifts), 2 = Staff, 3 = Senior (30 shifts and more).
create or replace function public.job_rank(p_shifts int)
returns int
language sql immutable set search_path = ''
as $$
  select case when p_shifts >= 30 then 3 when p_shifts >= 10 then 2 else 1 end
$$;

-- Pay for one shift: the job's pay, the rank raise (+25% / +50%) and the admin pay setting.
create or replace function public.job_shift_pay(p_pay bigint, p_shifts int)
returns bigint
language sql stable set search_path = ''
as $$
  select (round(p_pay * (case public.job_rank(p_shifts) when 3 then 1.5 when 2 then 1.25 else 1 end)
                * public.config_number('job_pay_percent', 100) / 100 / 10000) * 10000)::bigint
$$;

-- Pays every finished shift. Called whenever the player's state is brought up to date.
create or replace function public.pay_job_shifts(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; v_before int; v_after int; v_total bigint;
begin
  for r in
    select w.*, j.name as job_name, j.boss_name
    from public.work_shifts w join public.jobs j on j.slug = w.job_slug
    where w.player_id = p_player and w.paid_at is null and w.ends_at <= now()
    order by w.id
    for update of w
  loop
    v_total := r.pay_kobo + r.bonus_kobo;
    if v_total > 0 then
      perform public.wallet_apply(p_player, v_total, 'salary', 'Pay: ' || r.job_name || ' shift');
    end if;
    update public.work_shifts set paid_at = now() where id = r.id;

    select shifts_done into v_before from public.player_jobs where player_id = p_player;
    update public.player_jobs set shifts_done = shifts_done + 1
    where player_id = p_player and job_slug = r.job_slug
    returning shifts_done into v_after;

    insert into public.notifications (player_id, kind, title, body)
    values (p_player, 'salary',
            '💰 ₦' || to_char(v_total / 100, 'FM999,999,990') || ' from ' || r.boss_name,
            r.boss_line);

    if v_after is not null and public.job_rank(v_after) > public.job_rank(coalesce(v_before, 0)) then
      insert into public.notifications (player_id, kind, title, body)
      values (p_player, 'promotion',
              '🎉 Promoted to ' || case public.job_rank(v_after) when 3 then 'Senior ' else '' end || r.job_name,
              r.boss_name || ' gave you a raise. Every shift now pays more.');
    end if;
  end loop;
end $$;

-- ---------- State brought up to date (now also pays finished shifts) ----------

create or replace function public.sync_player_state(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_home uuid; v_s public.player_state%rowtype; v_gain int; v_new boolean := false;
begin
  select l.id into v_home
  from public.enrollments e
  join public.locations l on l.university_id = e.university_id and l.kind = 'hostel'
  where e.player_id = p_player and e.status = 'active';
  if v_home is null then raise exception 'not enrolled'; end if;

  insert into public.player_state (player_id, location_id)
  values (p_player, v_home)
  on conflict (player_id) do nothing;
  get diagnostics v_gain = row_count;
  v_new := v_gain > 0;

  select * into v_s from public.player_state where player_id = p_player for update;

  if v_new then
    update public.player_state set shard = public.assign_hostel_room(p_player) where player_id = p_player;
  end if;

  if v_s.asleep_since is null then
    v_gain := floor(extract(epoch from (now() - v_s.regen_at)) / 3600
                    * public.config_number('awake_energy_per_hour', 4));
    if v_gain >= 1 or v_s.energy >= 100 then
      update public.player_state
      set energy = least(100, energy + greatest(v_gain, 0)), regen_at = now()
      where player_id = p_player;
    end if;
  end if;

  update public.player_state set
    last_seen_at = now(),
    busy_until = case when busy_until <= now() then null else busy_until end,
    busy_activity = case when busy_until <= now() then null else busy_activity end
  where player_id = p_player;

  if exists (select 1 from public.work_shifts
             where player_id = p_player and paid_at is null and ends_at <= now()) then
    perform public.pay_job_shifts(p_player);
  end if;
end $$;

-- ---------- What the screen needs (now includes your job) ----------

create or replace function public.game_dynamic(p_player uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'state', (
      select jsonb_build_object(
        'energy', s.energy, 'health', s.health, 'happiness', s.happiness,
        'location_kind', l.kind, 'asleep_since', s.asleep_since,
        'busy_until', s.busy_until, 'busy_activity', s.busy_activity,
        'room', s.shard, 'share_location', pl.share_location)
      from public.player_state s
      join public.players pl on pl.id = s.player_id
      left join public.locations l on l.id = s.location_id
      where s.player_id = p_player),
    'balance_kobo', (select balance_kobo from public.wallets where player_id = p_player),
    'unread', (select count(*) from public.notifications
               where player_id = p_player and read_at is null),
    'cooldowns', coalesce((
      select jsonb_object_agg(activity_slug, available_at)
      from public.player_cooldowns
      where player_id = p_player and available_at > now()), '{}'::jsonb),
    'job', (
      select jsonb_build_object(
        'slug', pj.job_slug,
        'shifts_done', pj.shifts_done,
        'rank', public.job_rank(pj.shifts_done),
        'pay_kobo', (select public.job_shift_pay(j.pay_kobo, pj.shifts_done)
                     from public.jobs j where j.slug = pj.job_slug),
        'shifts_today', (select count(*) from public.work_shifts w
                         where w.player_id = p_player
                           and w.work_day = (now() at time zone 'Africa/Lagos')::date),
        'daily_limit', public.config_number('job_daily_shifts', 3)::int,
        'can_change_at', pj.changed_at
                         + make_interval(hours => public.config_number('job_change_hours', 24)::int),
        'last_pay', (select jsonb_build_object(
                       'id', w.id, 'job', w.job_slug, 'pay_kobo', w.pay_kobo,
                       'bonus_kobo', w.bonus_kobo, 'boss_line', w.boss_line, 'paid_at', w.paid_at)
                     from public.work_shifts w
                     where w.player_id = p_player and w.paid_at is not null
                     order by w.id desc limit 1))
      from public.player_jobs pj where pj.player_id = p_player),
    'server_time', now()
  )
$$;

-- ---------- Getting hired, quitting and working ----------

create or replace function public.apply_job(p_user_id uuid, p_job text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_job public.jobs%rowtype; v_s public.player_state%rowtype; v_kind text;
  v_level int; v_cgpa numeric; v_age int; v_pj public.player_jobs%rowtype; v_hour int;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('job:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select * into v_job from public.jobs where slug = p_job and is_active;
  if not found then raise exception 'unknown job'; end if;

  select * into v_s from public.player_state where player_id = v_me for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind is distinct from v_job.location_kind then raise exception 'wrong place'; end if;

  v_hour := extract(hour from (now() at time zone 'Africa/Lagos'))::int;
  if not public.job_open(v_job.open_hour, v_job.close_hour, v_hour) then raise exception 'boss not in'; end if;

  select e.level_year, e.cgpa into v_level, v_cgpa
  from public.enrollments e where e.player_id = v_me and e.status = 'active';
  select age into v_age from public.players where id = v_me;
  if v_level < v_job.min_level then raise exception 'job: level too low'; end if;
  if v_job.min_cgpa is not null and coalesce(v_cgpa, 0) < v_job.min_cgpa then raise exception 'job: cgpa too low'; end if;
  if v_age < v_job.min_age then raise exception 'job: too young'; end if;

  select * into v_pj from public.player_jobs where player_id = v_me for update;
  if found then
    if v_pj.job_slug = v_job.slug then return public.game_dynamic(v_me); end if;
    if v_pj.job_slug is not null then raise exception 'job: quit first'; end if;
    if v_pj.hired_at is not null and v_pj.changed_at
         > now() - make_interval(hours => public.config_number('job_change_hours', 24)::int) then
      raise exception 'job: wait';
    end if;
    update public.player_jobs
    set job_slug = v_job.slug, shifts_done = 0, hired_at = now(), changed_at = now()
    where player_id = v_me;
  else
    insert into public.player_jobs (player_id, job_slug, hired_at, changed_at)
    values (v_me, v_job.slug, now(), now());
  end if;

  insert into public.notifications (player_id, kind, title, body)
  values (v_me, 'job', '💼 You are now a ' || v_job.name,
          v_job.boss_name || ' (' || v_job.boss_title || ') hired you. Come back during working hours to start a shift.');

  return public.game_dynamic(v_me);
end $$;

create or replace function public.quit_job(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_s public.player_state%rowtype;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('job:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select * into v_s from public.player_state where player_id = v_me for update;
  if v_s.busy_activity like 'work:%' and v_s.busy_until > now() then raise exception 'busy'; end if;

  update public.player_jobs set job_slug = null, shifts_done = 0, changed_at = now()
  where player_id = v_me and job_slug is not null;

  return public.game_dynamic(v_me);
end $$;

create or replace function public.start_shift(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_s public.player_state%rowtype; v_pj public.player_jobs%rowtype;
  v_job public.jobs%rowtype; v_kind text; v_hour int; v_today date; v_done int;
  v_pay bigint; v_bonus bigint := 0; v_line text; v_roll double precision;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('shift:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select * into v_s from public.player_state where player_id = v_me for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;

  select * into v_pj from public.player_jobs where player_id = v_me for update;
  if not found or v_pj.job_slug is null then raise exception 'job: none'; end if;
  select * into v_job from public.jobs where slug = v_pj.job_slug;
  if not v_job.is_active then raise exception 'job: closed'; end if;

  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind is distinct from v_job.location_kind then raise exception 'wrong place'; end if;

  v_hour := extract(hour from (now() at time zone 'Africa/Lagos'))::int;
  if not public.job_open(v_job.open_hour, v_job.close_hour, v_hour) then raise exception 'boss not in'; end if;

  v_today := (now() at time zone 'Africa/Lagos')::date;
  select count(*) into v_done from public.work_shifts where player_id = v_me and work_day = v_today;
  if v_done >= public.config_number('job_daily_shifts', 3)::int then raise exception 'job: enough today'; end if;

  if v_s.energy < v_job.energy_cost then raise exception 'too tired'; end if;

  -- The boss decides how the shift went: tired workers get no bonus.
  v_pay := public.job_shift_pay(v_job.pay_kobo, v_pj.shifts_done);
  v_roll := random();
  if v_s.happiness < 20 or v_s.health < 20 then
    v_line := 'You looked tired today. Rest well before your next shift.';
  elsif v_s.happiness >= 50 and v_roll < 0.25 then
    v_bonus := greatest(10000, round(v_pay * 0.2 / 10000) * 10000)::bigint;
    v_line := 'You worked very hard today. Take a little extra.';
  else
    v_line := (array['Good job today. See you next shift.',
                     'Thank you. Everybody was happy with your work.',
                     'Not bad at all. Keep it up.',
                     'You are getting better at this.'])[1 + floor(v_roll * 4)::int];
  end if;

  update public.player_state set
    energy = greatest(0, energy - v_job.energy_cost),
    happiness = greatest(0, least(100, happiness + v_job.happiness_delta)),
    busy_until = now() + make_interval(mins => v_job.shift_minutes),
    busy_activity = 'work:' || v_job.slug,
    updated_at = now()
  where player_id = v_me;

  insert into public.work_shifts (player_id, job_slug, work_day, ends_at, pay_kobo, bonus_kobo, boss_line)
  values (v_me, v_job.slug, v_today, now() + make_interval(mins => v_job.shift_minutes), v_pay, v_bonus, v_line);

  return public.game_dynamic(v_me);
end $$;

-- ---------- The job list goes out with the game state ----------

create or replace function public.get_game_state(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player public.players%rowtype; v_status text; v_enr record;
begin
  select status into v_status from public.profiles where id = p_user_id;
  if v_status is distinct from 'active' then return jsonb_build_object('status', 'blocked'); end if;

  select * into v_player from public.players where user_id = p_user_id;
  if not found then return jsonb_build_object('status', 'no_player'); end if;

  select e.level_year, e.university_id, c.name as course, u.name as uni_name, u.short_name,
         u.primary_color, u.secondary_color, d.name as department, f.name as faculty
  into v_enr
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  join public.departments d on d.id = c.department_id
  join public.faculties f on f.id = d.faculty_id
  join public.universities u on u.id = e.university_id
  where e.player_id = v_player.id and e.status = 'active';
  if not found then return jsonb_build_object('status', 'not_enrolled'); end if;

  perform public.sync_player_state(v_player.id);

  return jsonb_build_object(
    'status', 'ok',
    'player', jsonb_build_object(
      'id', v_player.id, 'name', v_player.display_name, 'age', v_player.age,
      'skin', v_player.avatar_skin, 'hair_style', v_player.avatar_hair_style,
      'hair_color', v_player.avatar_hair_color, 'outfit', v_player.avatar_outfit),
    'enrollment', jsonb_build_object(
      'level_year', v_enr.level_year, 'course', v_enr.course,
      'department', v_enr.department, 'faculty', v_enr.faculty,
      'university', jsonb_build_object(
        'name', v_enr.uni_name, 'short_name', v_enr.short_name,
        'primary_color', v_enr.primary_color, 'secondary_color', v_enr.secondary_color)),
    'faculties', (
      select coalesce(jsonb_agg(f.name order by f.name), '[]'::jsonb)
      from public.faculties f where f.university_id = v_enr.university_id),
    'locations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'name', l.name, 'kind', l.kind, 'description', l.description,
        'map_x', l.map_x, 'map_y', l.map_y, 'has_billboard', l.has_billboard) order by l.name),
        '[]'::jsonb)
      from public.locations l where l.university_id = v_enr.university_id),
    'activities', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'name', a.name, 'description', a.description,
        'location_kind', a.location_kind, 'duration_minutes', a.duration_minutes,
        'energy_delta', a.energy_delta, 'health_delta', a.health_delta,
        'happiness_delta', a.happiness_delta, 'cost_kobo', a.cost_kobo,
        'ends_day', a.ends_day, 'cooldown_minutes', a.cooldown_minutes) order by a.sort_order),
        '[]'::jsonb)
      from public.activities a where a.is_active),
    'interactions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', i.slug, 'name', i.name, 'verb', i.verb, 'emoji', i.emoji, 'pose', i.pose,
        'place_kinds', i.place_kinds, 'energy_cost', i.energy_cost, 'cost_kobo', i.cost_kobo,
        'bond_delta', i.bond_delta) order by i.sort_order),
        '[]'::jsonb)
      from public.interaction_types i where i.is_active),
    'jobs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', j.slug, 'name', j.name, 'description', j.description,
        'location_kind', j.location_kind, 'boss_name', j.boss_name, 'boss_title', j.boss_title,
        'pay_kobo', public.job_shift_pay(j.pay_kobo, 0), 'shift_minutes', j.shift_minutes,
        'energy_cost', j.energy_cost, 'happiness_delta', j.happiness_delta,
        'open_hour', j.open_hour, 'close_hour', j.close_hour,
        'min_level', j.min_level, 'min_cgpa', j.min_cgpa, 'min_age', j.min_age) order by j.sort_order),
        '[]'::jsonb)
      from public.jobs j where j.is_active),
    'ads', public.live_ads(v_enr.university_id)
  ) || public.game_dynamic(v_player.id);
end $$;

revoke all on function public.job_open(int, int, int) from public, anon, authenticated;
revoke all on function public.job_rank(int) from public, anon, authenticated;
revoke all on function public.job_shift_pay(bigint, int) from public, anon, authenticated;
revoke all on function public.pay_job_shifts(uuid) from public, anon, authenticated, service_role;
revoke all on function public.apply_job(uuid, text) from public, anon, authenticated;
revoke all on function public.quit_job(uuid) from public, anon, authenticated;
revoke all on function public.start_shift(uuid) from public, anon, authenticated;
grant execute on function public.apply_job(uuid, text) to service_role;
grant execute on function public.quit_job(uuid) to service_role;
grant execute on function public.start_shift(uuid) to service_role;
