-- CAMPUS LIFE: Stage 5A - real Nigerian time, and the whole game state in one call
-- Safe to run more than once.
--
-- Time is the real clock (Africa/Lagos), the same for everyone. There is no personal
-- "hours left" budget any more: energy and money are the limits.
--  * Activities take real minutes and keep the player busy until they finish.
--  * Sleep lasts as long as the player likes; energy comes back with real time asleep.
--  * Awake players slowly get energy back too, even while offline.
--  * Energy-giving activities have cooldowns, so they cannot be spammed.

-- ---------- Settings ----------
insert into public.app_config (key, value) values
  ('sleep_energy_per_hour', '17'),
  ('awake_energy_per_hour', '4')
on conflict (key) do nothing;

-- ---------- Activities: real minutes and cooldowns ----------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'activities'
               and column_name = 'duration_hours') then
    alter table public.activities rename column duration_hours to duration_minutes;
  end if;
end $$;

alter table public.activities add column if not exists cooldown_minutes integer not null default 0
  check (cooldown_minutes between 0 and 10080);

update public.activities a set cooldown_minutes = v.c
from (values ('nap', 180), ('bread_and_tea', 30), ('cafeteria_meal', 60),
             ('street_food', 45), ('snacks', 20), ('health_checkup', 720)) as v (slug, c)
where a.slug = v.slug;

create table if not exists public.player_cooldowns (
  player_id uuid not null references public.players (id) on delete cascade,
  activity_slug text not null references public.activities (slug) on delete cascade,
  available_at timestamptz not null,
  primary key (player_id, activity_slug)
);
alter table public.player_cooldowns enable row level security;
revoke all on public.player_cooldowns from anon, authenticated;

-- ---------- Player state: from a personal clock to real time ----------
alter table public.player_state add column if not exists asleep_since timestamptz;
alter table public.player_state add column if not exists busy_until timestamptz;
alter table public.player_state add column if not exists busy_activity text;
alter table public.player_state add column if not exists regen_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'player_state'
               and column_name = 'slept_today') then
    -- Anyone in bed right now stays in bed.
    execute 'update public.player_state set asleep_since = now() where slept_today and asleep_since is null';
  end if;
end $$;

drop function if exists public.ensure_today(uuid);
drop function if exists public.wake_up(uuid);
drop function if exists public.travel_to(uuid, uuid);
drop function if exists public.perform_activity(uuid, text);

alter table public.player_state
  drop column if exists hours_left,
  drop column if exists slept_today,
  drop column if exists day_number;

drop table if exists public.world_clock;

-- ---------- Internal helpers (no one can call these directly) ----------

-- The caller's player, refusing suspended or banned accounts.
create or replace function public.active_player_id(p_user_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_player uuid;
begin
  if not exists (select 1 from public.profiles where id = p_user_id and status = 'active') then
    raise exception 'blocked';
  end if;
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;
  return v_player;
end $$;

-- Brings a player's state up to now: creates it on first visit, adds awake energy, ends finished activities.
create or replace function public.sync_player_state(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_home uuid; v_s public.player_state%rowtype; v_gain int;
begin
  select l.id into v_home
  from public.enrollments e
  join public.locations l on l.university_id = e.university_id and l.kind = 'hostel'
  where e.player_id = p_player and e.status = 'active';
  if v_home is null then raise exception 'not enrolled'; end if;

  insert into public.player_state (player_id, location_id)
  values (p_player, v_home)
  on conflict (player_id) do nothing;

  select * into v_s from public.player_state where player_id = p_player for update;

  if v_s.asleep_since is null then
    v_gain := floor(extract(epoch from (now() - v_s.regen_at)) / 3600
                    * public.config_number('awake_energy_per_hour', 4));
    if v_gain >= 1 or v_s.energy >= 100 then
      update public.player_state
      set energy = least(100, energy + greatest(v_gain, 0)), regen_at = now()
      where player_id = p_player;
    end if;
  end if;

  if v_s.busy_until is not null and v_s.busy_until <= now() then
    update public.player_state set busy_until = null, busy_activity = null
    where player_id = p_player;
  end if;
end $$;

-- Everything that changes while playing, in one small JSON object.
create or replace function public.game_dynamic(p_player uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'state', (
      select jsonb_build_object(
        'energy', s.energy, 'health', s.health, 'happiness', s.happiness,
        'location_kind', l.kind, 'asleep_since', s.asleep_since,
        'busy_until', s.busy_until, 'busy_activity', s.busy_activity)
      from public.player_state s
      left join public.locations l on l.id = s.location_id
      where s.player_id = p_player),
    'balance_kobo', (select balance_kobo from public.wallets where player_id = p_player),
    'unread', (select count(*) from public.notifications
               where player_id = p_player and read_at is null),
    'cooldowns', coalesce((
      select jsonb_object_agg(activity_slug, available_at)
      from public.player_cooldowns
      where player_id = p_player and available_at > now()), '{}'::jsonb),
    'server_time', now()
  )
$$;

revoke all on function public.active_player_id(uuid) from public, anon, authenticated;
revoke all on function public.sync_player_state(uuid) from public, anon, authenticated;
revoke all on function public.game_dynamic(uuid) from public, anon, authenticated;

-- ---------- What the game server calls ----------

-- The whole game screen in ONE database call.
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
         u.primary_color, u.secondary_color
  into v_enr
  from public.enrollments e
  join public.courses c on c.id = e.course_id
  join public.universities u on u.id = e.university_id
  where e.player_id = v_player.id and e.status = 'active';
  if not found then return jsonb_build_object('status', 'not_enrolled'); end if;

  perform public.sync_player_state(v_player.id);

  return jsonb_build_object(
    'status', 'ok',
    'player', jsonb_build_object(
      'id', v_player.id, 'name', v_player.display_name,
      'skin', v_player.avatar_skin, 'hair_style', v_player.avatar_hair_style,
      'hair_color', v_player.avatar_hair_color, 'outfit', v_player.avatar_outfit),
    'enrollment', jsonb_build_object(
      'level_year', v_enr.level_year, 'course', v_enr.course,
      'university', jsonb_build_object(
        'name', v_enr.uni_name, 'short_name', v_enr.short_name,
        'primary_color', v_enr.primary_color, 'secondary_color', v_enr.secondary_color)),
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
      from public.activities a where a.is_active)
  ) || public.game_dynamic(v_player.id);
end $$;

-- Just the changing part (after sending money, for example).
create or replace function public.get_game_dynamic(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid;
begin
  v_player := public.active_player_id(p_user_id);
  perform public.sync_player_state(v_player);
  return public.game_dynamic(v_player);
end $$;

create or replace function public.perform_activity(p_user_id uuid, p_activity text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_s public.player_state%rowtype; v_act public.activities%rowtype; v_kind text;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('activity:u:' || p_user_id, 30, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;

  select * into v_act from public.activities where slug = p_activity and is_active;
  if not found then raise exception 'unknown activity'; end if;

  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind is distinct from v_act.location_kind then raise exception 'wrong place'; end if;

  if exists (select 1 from public.player_cooldowns
             where player_id = v_player and activity_slug = v_act.slug and available_at > now()) then
    raise exception 'cooldown';
  end if;

  if not v_act.ends_day and v_act.energy_delta < 0 and v_s.energy < -v_act.energy_delta then
    raise exception 'too tired';
  end if;

  if v_act.cost_kobo > 0 then
    perform public.wallet_apply(v_player, -v_act.cost_kobo, 'activity', v_act.name);
  end if;

  if v_act.ends_day then
    -- Going to bed: energy comes back with real time asleep (see wake_up).
    update public.player_state set
      asleep_since = now(), busy_until = null, busy_activity = null, updated_at = now()
    where player_id = v_player;
  else
    update public.player_state set
      energy = greatest(0, least(100, energy + v_act.energy_delta)),
      health = greatest(0, least(100, health + v_act.health_delta)),
      happiness = greatest(0, least(100, happiness + v_act.happiness_delta)),
      busy_until = now() + make_interval(secs => (v_act.duration_minutes * 60)::double precision),
      busy_activity = v_act.slug,
      updated_at = now()
    where player_id = v_player;
  end if;

  if v_act.cooldown_minutes > 0 then
    insert into public.player_cooldowns (player_id, activity_slug, available_at)
    values (v_player, v_act.slug, now() + make_interval(mins => v_act.cooldown_minutes))
    on conflict (player_id, activity_slug) do update set available_at = excluded.available_at;
  end if;

  return public.game_dynamic(v_player);
end $$;

-- Ends sleep whenever the player likes. Energy comes back with real time asleep.
create or replace function public.wake_up(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_hours numeric;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('wake:u:' || p_user_id, 20, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is null then return public.game_dynamic(v_player); end if;

  v_hours := extract(epoch from (now() - v_s.asleep_since)) / 3600;

  update public.player_state set
    energy = least(100, energy + floor(v_hours * public.config_number('sleep_energy_per_hour', 17))::int),
    health = least(100, health + least(5, floor(v_hours))::int),
    happiness = least(100, happiness + case when v_hours >= 6 then 3 else 0 end),
    asleep_since = null,
    regen_at = now(),
    updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

-- Walking into another building. Costs a little energy; the walk itself happens in 3D.
create or replace function public.travel_to(p_user_id uuid, p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_uni uuid; v_s public.player_state%rowtype;
  v_from public.locations%rowtype; v_to public.locations%rowtype; v_cost int;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('travel:u:' || p_user_id, 60, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select e.university_id into v_uni
  from public.enrollments e where e.player_id = v_player and e.status = 'active';

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;

  select * into v_to from public.locations where id = p_location_id and university_id = v_uni;
  if not found then raise exception 'unknown location'; end if;
  if v_to.id = v_s.location_id then return public.game_dynamic(v_player); end if;

  select * into v_from from public.locations where id = v_s.location_id;
  v_cost := greatest(1, ceil(sqrt(power(v_from.map_x - v_to.map_x, 2)
                                 + power(v_from.map_y - v_to.map_y, 2)) / 25.0))::int;
  if v_s.energy < v_cost then raise exception 'too tired'; end if;

  update public.player_state set
    location_id = v_to.id, energy = energy - v_cost, updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

revoke all on function public.get_game_state(uuid) from public, anon, authenticated;
revoke all on function public.get_game_dynamic(uuid) from public, anon, authenticated;
revoke all on function public.perform_activity(uuid, text) from public, anon, authenticated;
revoke all on function public.wake_up(uuid) from public, anon, authenticated;
revoke all on function public.travel_to(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_game_state(uuid) to service_role;
grant execute on function public.get_game_dynamic(uuid) to service_role;
grant execute on function public.perform_activity(uuid, text) to service_role;
grant execute on function public.wake_up(uuid) to service_role;
grant execute on function public.travel_to(uuid, uuid) to service_role;
