-- CAMPUS LIFE: Stage 5B - social life in places
-- Who is here, interactions (talk, toast, dance, fight...), local chat, block, report.
-- Safe to run more than once.

-- =====================================================
-- Presence: "online" = seen in the last 90 seconds
-- =====================================================
alter table public.player_state add column if not exists last_seen_at timestamptz not null default now();
create index if not exists player_state_presence_idx
  on public.player_state (location_id, last_seen_at desc);

-- =====================================================
-- Interaction types (data, so new ones need no code change)
-- =====================================================
create table if not exists public.interaction_types (
  slug text primary key check (slug ~ '^[a-z_]{2,30}$'),
  name text not null check (length(name) between 2 and 30),
  verb text not null check (length(verb) between 2 and 40),
  emoji text not null check (length(emoji) between 1 and 8),
  pose text not null check (pose in ('talk', 'toast', 'dance', 'fight', 'busy', 'exercise')),
  place_kinds text[] not null,
  energy_cost smallint not null default 0 check (energy_cost between 0 and 50),
  cost_kobo bigint not null default 0 check (cost_kobo >= 0),
  actor_happiness smallint not null default 0 check (actor_happiness between -20 and 20),
  actor_health smallint not null default 0 check (actor_health between -20 and 20),
  target_happiness smallint not null default 0 check (target_happiness between -20 and 20),
  target_health smallint not null default 0 check (target_health between -20 and 20),
  bond_delta smallint not null check (bond_delta between -50 and 50),
  pair_cooldown_seconds integer not null default 60 check (pair_cooldown_seconds between 0 and 86400),
  sort_order smallint not null default 0,
  is_active boolean not null default true
);
alter table public.interaction_types enable row level security;
revoke all on public.interaction_types from anon, authenticated;

insert into public.interaction_types
  (slug, name, verb, emoji, pose, place_kinds, energy_cost, cost_kobo,
   actor_happiness, actor_health, target_happiness, target_health, bond_delta,
   pair_cooldown_seconds, sort_order)
values
  ('talk', 'Talk', 'had a chat with', '💬', 'talk',
   array['hostel','faculty','library','cafeteria','market','sports','clubhouse','health'],
   1, 0, 2, 0, 1, 0, 2, 60, 1),
  ('toast', 'Toast', 'raised a glass with', '🥂', 'toast',
   array['clubhouse','cafeteria'], 1, 50000, 4, 0, 4, 0, 4, 300, 2),
  ('dance', 'Dance', 'danced with', '💃', 'dance',
   array['clubhouse','hostel'], 6, 0, 5, 0, 5, 0, 5, 120, 3),
  ('high_five', 'High five', 'high-fived', '🙌', 'toast',
   array['sports','faculty','hostel','market'], 0, 0, 1, 0, 2, 0, 1, 60, 4),
  ('study_together', 'Study together', 'studied with', '📚', 'busy',
   array['library','faculty'], 4, 0, 1, 0, 1, 0, 4, 600, 5),
  ('fight', 'Fight', 'started a fight with', '👊', 'fight',
   array['clubhouse','market','sports','hostel','cafeteria'], 10, 0, -3, -6, -4, -3, -20, 1800, 9)
on conflict (slug) do update set
  name = excluded.name, verb = excluded.verb, emoji = excluded.emoji, pose = excluded.pose,
  place_kinds = excluded.place_kinds, energy_cost = excluded.energy_cost,
  cost_kobo = excluded.cost_kobo, actor_happiness = excluded.actor_happiness,
  actor_health = excluded.actor_health, target_happiness = excluded.target_happiness,
  target_health = excluded.target_health, bond_delta = excluded.bond_delta,
  pair_cooldown_seconds = excluded.pair_cooldown_seconds, sort_order = excluded.sort_order;

-- =====================================================
-- Relationships between two players (one row per pair, a < b)
-- =====================================================
create table if not exists public.relationships (
  player_a uuid not null references public.players (id) on delete cascade,
  player_b uuid not null references public.players (id) on delete cascade,
  bond smallint not null default 0 check (bond between -100 and 100),
  interactions integer not null default 0,
  last_interaction_at timestamptz not null default now(),
  primary key (player_a, player_b),
  check (player_a < player_b)
);
create index if not exists relationships_b_idx on public.relationships (player_b);
alter table public.relationships enable row level security;
revoke all on public.relationships from anon, authenticated;

-- =====================================================
-- What happens in a place (chat lines and interactions). Kept for 2 days.
-- =====================================================
create table if not exists public.place_events (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.locations (id) on delete cascade,
  actor_id uuid not null references public.players (id) on delete cascade,
  target_id uuid references public.players (id) on delete cascade,
  kind text not null check (length(kind) between 2 and 30),
  body text check (length(body) <= 140),
  created_at timestamptz not null default now()
);
create index if not exists place_events_location_idx on public.place_events (location_id, id desc);
create index if not exists place_events_pair_idx
  on public.place_events (actor_id, target_id, kind, created_at desc);
alter table public.place_events enable row level security;
revoke all on public.place_events from anon, authenticated;

-- =====================================================
-- Blocks and reports
-- =====================================================
create table if not exists public.blocks (
  blocker_id uuid not null references public.players (id) on delete cascade,
  blocked_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;

create table if not exists public.player_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.players (id) on delete cascade,
  reported_id uuid not null references public.players (id) on delete cascade,
  reason text not null check (reason in ('harassment','hate','spam','cheating','inappropriate','other')),
  details text check (length(details) <= 300),
  -- A copy of what was said, so the evidence survives after chat lines are cleared.
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index if not exists player_reports_status_idx on public.player_reports (status, created_at desc);
alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;

-- =====================================================
-- Keep "last seen" fresh whenever the player does anything
-- =====================================================
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

  update public.player_state set
    last_seen_at = now(),
    busy_until = case when busy_until <= now() then null else busy_until end,
    busy_activity = case when busy_until <= now() then null else busy_activity end
  where player_id = p_player;
end $$;

-- =====================================================
-- The game state now also lists the interactions
-- =====================================================
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
      from public.activities a where a.is_active),
    'interactions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', i.slug, 'name', i.name, 'verb', i.verb, 'emoji', i.emoji, 'pose', i.pose,
        'place_kinds', i.place_kinds, 'energy_cost', i.energy_cost, 'cost_kobo', i.cost_kobo,
        'bond_delta', i.bond_delta) order by i.sort_order),
        '[]'::jsonb)
      from public.interaction_types i where i.is_active)
  ) || public.game_dynamic(v_player.id);
end $$;

-- =====================================================
-- Who is around, and what just happened here. Polled every few seconds.
-- =====================================================
create or replace function public.world_snapshot(p_user_id uuid, p_since bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_loc uuid; v_uni uuid;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('snapshot:u:' || p_user_id, 40, 60) then
    raise exception 'slow down';
  end if;

  update public.player_state set last_seen_at = now()
  where player_id = v_player
  returning location_id into v_loc;
  if v_loc is null then raise exception 'not enrolled'; end if;
  select university_id into v_uni from public.locations where id = v_loc;

  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(x.p order by x.seen desc)
      from (
        select jsonb_build_object(
                 'id', pl.id, 'name', pl.display_name,
                 'skin', pl.avatar_skin, 'hair_style', pl.avatar_hair_style,
                 'hair_color', pl.avatar_hair_color, 'outfit', pl.avatar_outfit,
                 'location_kind', l.kind,
                 'asleep', s.asleep_since is not null,
                 'activity', case when s.busy_until > now() then s.busy_activity end,
                 'bond', coalesce(r.bond, 0)) as p,
               s.last_seen_at as seen
        from public.locations l
        join public.player_state s
          on s.location_id = l.id and s.last_seen_at > now() - interval '90 seconds'
        join public.players pl on pl.id = s.player_id
        join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
        left join public.relationships r
          on r.player_a = least(v_player, pl.id) and r.player_b = greatest(v_player, pl.id)
        where l.university_id = v_uni
          and pl.id <> v_player
          and not exists (select 1 from public.blocks b
                          where (b.blocker_id = v_player and b.blocked_id = pl.id)
                             or (b.blocker_id = pl.id and b.blocked_id = v_player))
        order by s.last_seen_at desc
        limit 60
      ) x), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(q.e order by q.id)
      from (
        select ev.id, jsonb_build_object(
                 'id', ev.id, 'kind', ev.kind, 'body', ev.body,
                 'actor_id', ev.actor_id, 'actor', a.display_name,
                 'target_id', ev.target_id, 'target', t.display_name,
                 'at', ev.created_at) as e
        from public.place_events ev
        join public.players a on a.id = ev.actor_id
        left join public.players t on t.id = ev.target_id
        where ev.location_id = v_loc
          and ev.id > coalesce(p_since, 0)
          and ev.created_at > now() - interval '10 minutes'
          and not exists (select 1 from public.blocks b
                          where (b.blocker_id = v_player and b.blocked_id = ev.actor_id)
                             or (b.blocker_id = ev.actor_id and b.blocked_id = v_player))
        order by ev.id desc
        limit 30
      ) q), '[]'::jsonb),
    'location_kind', (select kind from public.locations where id = v_loc),
    'server_time', now()
  );
end $$;

-- =====================================================
-- Interacting with another player
-- =====================================================
create or replace function public.social_interact(p_user_id uuid, p_target uuid, p_kind text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_s public.player_state%rowtype; v_t public.player_state%rowtype;
  v_type public.interaction_types%rowtype; v_kind text; v_event bigint;
  v_name text; v_tname text; v_thrown boolean := false; v_gate uuid;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('interact:u:' || p_user_id, 20, 60) then
    raise exception 'slow down';
  end if;
  if p_target = v_player then raise exception 'not yourself'; end if;

  select * into v_type from public.interaction_types where slug = p_kind and is_active;
  if not found then raise exception 'unknown interaction'; end if;

  perform public.sync_player_state(v_player);

  -- Lock both players in a fixed order so two people acting on each other cannot deadlock.
  perform 1 from public.player_state
  where player_id in (v_player, p_target) order by player_id for update;

  select * into v_s from public.player_state where player_id = v_player;
  select * into v_t from public.player_state where player_id = p_target;
  if not found then raise exception 'not here'; end if;

  -- Blocked (either way), banned, elsewhere or offline all look the same: "not here".
  if not exists (select 1 from public.players pl
                 join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
                 where pl.id = p_target)
     or v_t.location_id is distinct from v_s.location_id
     or v_t.last_seen_at < now() - interval '90 seconds'
     or exists (select 1 from public.blocks b
                where (b.blocker_id = v_player and b.blocked_id = p_target)
                   or (b.blocker_id = p_target and b.blocked_id = v_player)) then
    raise exception 'not here';
  end if;

  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  if v_t.asleep_since is not null then raise exception 'they are asleep'; end if;

  select kind into v_kind from public.locations where id = v_s.location_id;
  if not (v_kind = any (v_type.place_kinds)) then raise exception 'not allowed here'; end if;

  if exists (select 1 from public.place_events
             where actor_id = v_player and target_id = p_target and kind = v_type.slug
               and created_at > now() - make_interval(secs => v_type.pair_cooldown_seconds)) then
    raise exception 'cooldown';
  end if;
  if v_s.energy < v_type.energy_cost then raise exception 'too tired'; end if;

  select display_name into v_name from public.players where id = v_player;
  select display_name into v_tname from public.players where id = p_target;

  if v_type.cost_kobo > 0 then
    perform public.wallet_apply(v_player, -v_type.cost_kobo, 'social',
      v_type.name || ' with ' || v_tname);
  end if;

  update public.player_state set
    energy = greatest(0, energy - v_type.energy_cost),
    happiness = greatest(0, least(100, happiness + v_type.actor_happiness)),
    health = greatest(0, least(100, health + v_type.actor_health)),
    updated_at = now()
  where player_id = v_player;

  update public.player_state set
    happiness = greatest(0, least(100, happiness + v_type.target_happiness)),
    health = greatest(0, least(100, health + v_type.target_health)),
    updated_at = now()
  where player_id = p_target;

  insert into public.relationships (player_a, player_b, bond, interactions)
  values (least(v_player, p_target), greatest(v_player, p_target), v_type.bond_delta, 1)
  on conflict (player_a, player_b) do update set
    bond = greatest(-100, least(100, public.relationships.bond + excluded.bond)),
    interactions = public.relationships.interactions + 1,
    last_interaction_at = now();

  insert into public.place_events (location_id, actor_id, target_id, kind)
  values (v_s.location_id, v_player, p_target, v_type.slug)
  returning id into v_event;

  if v_type.slug = 'fight' then
    insert into public.notifications (player_id, kind, title, data)
    values (p_target, 'fight', v_name || ' started a fight with you 👊',
            jsonb_build_object('from', v_player));

    -- Start a fight in the club and the bouncers throw you out to the main gate.
    if v_kind = 'clubhouse' then
      select l.id into v_gate from public.locations l
      where l.kind = 'market'
        and l.university_id = (select university_id from public.locations where id = v_s.location_id);
      if v_gate is not null then
        update public.player_state set location_id = v_gate where player_id = v_player;
        insert into public.place_events (location_id, actor_id, kind)
        values (v_s.location_id, v_player, 'thrown_out');
        v_thrown := true;
      end if;
    end if;
  end if;

  -- Now and then, clear out old chatter.
  if random() < 0.01 then
    delete from public.place_events where created_at < now() - interval '2 days';
  end if;

  return public.game_dynamic(v_player)
    || jsonb_build_object('event_id', v_event, 'thrown_out', v_thrown);
end $$;

-- Saying something to everyone in the room.
create or replace function public.say_in_place(p_user_id uuid, p_text text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_text text; v_id bigint;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('say:u:' || p_user_id, 8, 20) then
    raise exception 'slow down';
  end if;

  v_text := trim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'),
                                '\s+', ' ', 'g'));
  if length(v_text) < 1 or length(v_text) > 140 then raise exception 'bad message'; end if;

  select * into v_s from public.player_state where player_id = v_player;
  if not found then raise exception 'not enrolled'; end if;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;

  update public.player_state set last_seen_at = now() where player_id = v_player;
  insert into public.place_events (location_id, actor_id, kind, body)
  values (v_s.location_id, v_player, 'message', v_text)
  returning id into v_id;

  return jsonb_build_object('event_id', v_id);
end $$;

create or replace function public.block_player(p_user_id uuid, p_target uuid, p_block boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid;
begin
  v_player := public.active_player_id(p_user_id);
  if p_target = v_player then raise exception 'not yourself'; end if;
  if not exists (select 1 from public.players where id = p_target) then
    raise exception 'unknown player';
  end if;
  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (v_player, p_target)
    on conflict do nothing;
  else
    delete from public.blocks where blocker_id = v_player and blocked_id = p_target;
  end if;
end $$;

create or replace function public.list_blocked(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid;
begin
  v_player := public.active_player_id(p_user_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name)
    from public.blocks b join public.players p on p.id = b.blocked_id
    where b.blocker_id = v_player), '[]'::jsonb);
end $$;

create or replace function public.report_player(
  p_user_id uuid, p_target uuid, p_reason text, p_details text, p_event_id bigint
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_context jsonb := '{}'::jsonb; v_id bigint;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('report:u:' || p_user_id, 10, 3600) then
    raise exception 'slow down';
  end if;
  if p_target = v_player then raise exception 'not yourself'; end if;
  if not exists (select 1 from public.players where id = p_target) then
    raise exception 'unknown player';
  end if;

  if p_event_id is not null then
    select jsonb_build_object('event_id', ev.id, 'kind', ev.kind, 'body', ev.body,
                              'at', ev.created_at, 'place', l.name)
    into v_context
    from public.place_events ev join public.locations l on l.id = ev.location_id
    where ev.id = p_event_id and ev.actor_id = p_target;
  end if;

  insert into public.player_reports (reporter_id, reported_id, reason, details, context)
  values (v_player, p_target, p_reason, nullif(left(trim(coalesce(p_details, '')), 300), ''),
          coalesce(v_context, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================
-- Who may call what: only our trusted server
-- =====================================================
revoke all on function public.world_snapshot(uuid, bigint) from public, anon, authenticated;
revoke all on function public.social_interact(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.say_in_place(uuid, text) from public, anon, authenticated;
revoke all on function public.block_player(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.list_blocked(uuid) from public, anon, authenticated;
revoke all on function public.report_player(uuid, uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.world_snapshot(uuid, bigint) to service_role;
grant execute on function public.social_interact(uuid, uuid, text) to service_role;
grant execute on function public.say_in_place(uuid, text) to service_role;
grant execute on function public.block_player(uuid, uuid, boolean) to service_role;
grant execute on function public.list_blocked(uuid) to service_role;
grant execute on function public.report_player(uuid, uuid, text, text, bigint) to service_role;
