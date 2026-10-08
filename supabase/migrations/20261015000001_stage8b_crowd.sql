-- CAMPUS LIFE: Stage 8B - crowd control
-- * Each place splits into rooms of limited size ("shards"); you join where your friends are.
-- * You see your active friends, plus a small number of nearby strangers who share their location.
-- * Your own hostel room with roommates, and visiting a friend's room.
-- * "Active" means seen in the last 60 seconds (configurable).
-- Safe to run more than once.

insert into public.app_config (key, value) values
  ('room_capacity', '25'),
  ('visible_strangers', '10'),
  ('visible_friends', '30'),
  ('presence_seconds', '60'),
  ('hostel_room_size', '4')
on conflict (key) do nothing;

alter table public.players add column if not exists share_location boolean not null default true;
alter table public.players add column if not exists hostel_room integer;
alter table public.player_state add column if not exists shard integer not null default 1;
alter table public.place_events add column if not exists shard integer not null default 1;

create index if not exists player_state_room_idx
  on public.player_state (location_id, shard, last_seen_at desc);
create index if not exists players_hostel_room_idx on public.players (hostel_room);

-- =====================================================
-- Rooms
-- =====================================================

-- Your own hostel room (shared with up to N roommates), handed out once.
create table if not exists public.presence_counts (
  university_id uuid primary key references public.universities (id) on delete cascade,
  online integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.presence_counts enable row level security;
revoke all on public.presence_counts from anon, authenticated;

create or replace function public.assign_hostel_room(p_player uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_room int; v_uni uuid; v_size int;
begin
  select hostel_room into v_room from public.players where id = p_player;
  if v_room is not null then return v_room; end if;

  select university_id into v_uni from public.enrollments
  where player_id = p_player and status = 'active';
  -- One assignment at a time per campus, so two students never take the last bed together.
  perform pg_advisory_xact_lock(hashtext('hostel:' || coalesce(v_uni::text, '')));
  v_size := public.config_number('hostel_room_size', 4)::int;

  select r.room into v_room from (
    select p.hostel_room as room, count(*) as n
    from public.players p
    join public.enrollments e on e.player_id = p.id and e.status = 'active' and e.university_id = v_uni
    where p.hostel_room is not null
    group by p.hostel_room
  ) r
  where r.n < v_size order by r.room limit 1;

  if v_room is null then
    select coalesce(max(p.hostel_room), 0) + 1 into v_room
    from public.players p
    join public.enrollments e on e.player_id = p.id and e.status = 'active' and e.university_id = v_uni;
  end if;

  update public.players set hostel_room = v_room where id = p_player;
  return v_room;
end $$;

-- Which room of a busy place to put someone in: with an active friend if there is space,
-- otherwise the fullest room that still has space (so rooms feel alive), otherwise a new one.
create or replace function public.pick_shard(p_player uuid, p_location uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_cap int; v_win interval; v_shard int;
begin
  v_cap := public.config_number('room_capacity', 25)::int;
  v_win := make_interval(secs => public.config_number('presence_seconds', 60)::int);

  with counts as (
    select s.shard, count(*) as n from public.player_state s
    where s.location_id = p_location and s.last_seen_at > now() - v_win and s.player_id <> p_player
    group by s.shard
  )
  select c.shard into v_shard from counts c
  where c.n < v_cap and exists (
    select 1 from public.player_state s
    join public.friendships f on f.status = 'accepted'
      and f.player_a = least(p_player, s.player_id) and f.player_b = greatest(p_player, s.player_id)
    where s.location_id = p_location and s.shard = c.shard and s.last_seen_at > now() - v_win)
  order by c.n desc limit 1;
  if v_shard is not null then return v_shard; end if;

  with counts as (
    select s.shard, count(*) as n from public.player_state s
    where s.location_id = p_location and s.last_seen_at > now() - v_win and s.player_id <> p_player
    group by s.shard
  )
  select c.shard into v_shard from counts c where c.n < v_cap order by c.n desc, c.shard limit 1;
  if v_shard is not null then return v_shard; end if;

  select coalesce(max(s.shard), 0) + 1 into v_shard from public.player_state s
  where s.location_id = p_location and s.last_seen_at > now() - v_win;
  return greatest(v_shard, 1);
end $$;

-- The room a player should be in at a place (home hostel = own room number).
create or replace function public.room_for(p_player uuid, p_location uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_kind text;
begin
  select kind into v_kind from public.locations where id = p_location;
  if v_kind = 'hostel' then return public.assign_hostel_room(p_player); end if;
  return public.pick_shard(p_player, p_location);
end $$;

-- =====================================================
-- State sync: first visit puts you in your own hostel room
-- =====================================================
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
end $$;

-- The changing part of the game now also says which room you are in.
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
    'server_time', now()
  )
$$;

-- =====================================================
-- Moving between places now picks your room
-- =====================================================
create or replace function public.travel_to(p_user_id uuid, p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_uni uuid; v_type public.university_type; v_s public.player_state%rowtype;
  v_from public.locations%rowtype; v_to public.locations%rowtype; v_cost int;
  v_hour int; v_fine bigint; v_fined boolean := false;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('travel:u:' || p_user_id, 60, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select e.university_id, u.type into v_uni, v_type
  from public.enrollments e join public.universities u on u.id = e.university_id
  where e.player_id = v_player and e.status = 'active';

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

  v_hour := extract(hour from (now() at time zone 'Africa/Lagos'))::int;
  if v_type = 'private' and v_from.kind = 'hostel' and (v_hour >= 23 or v_hour < 5) then
    v_fine := public.config_number('curfew_fine_kobo', 200000)::bigint;
    if not exists (select 1 from public.wallets where player_id = v_player and balance_kobo >= v_fine) then
      raise exception 'curfew';
    end if;
    perform public.wallet_apply(v_player, -v_fine, 'curfew_fine', 'Gate fine: left the hostel after curfew');
    v_fined := true;
  end if;

  update public.player_state set
    location_id = v_to.id, energy = energy - v_cost,
    shard = public.room_for(v_player, v_to.id), updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player) || jsonb_build_object('curfew_fine', v_fined);
end $$;

-- Move into a friend's room at the same place (or visit a friend's hostel room).
create or replace function public.join_friend_room(p_user_id uuid, p_friend uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_s public.player_state%rowtype; v_f public.player_state%rowtype; v_kind text; v_n int; v_cap int;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('join:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  if not public.are_friends(v_me, p_friend) or public.blocked_between(v_me, p_friend) then
    raise exception 'not friends';
  end if;
  perform public.sync_player_state(v_me);

  select * into v_s from public.player_state where player_id = v_me for update;
  select * into v_f from public.player_state where player_id = p_friend;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  if v_f.location_id is distinct from v_s.location_id
     or v_f.last_seen_at < now() - make_interval(secs => public.config_number('presence_seconds', 60)::int) then
    raise exception 'not here';
  end if;
  if v_f.shard = v_s.shard then return public.game_dynamic(v_me); end if;

  select kind into v_kind from public.locations where id = v_s.location_id;
  v_cap := case when v_kind = 'hostel'
                then public.config_number('hostel_room_size', 4)::int + 2   -- room for a couple of visitors
                else public.config_number('room_capacity', 25)::int end;
  select count(*) into v_n from public.player_state
  where location_id = v_s.location_id and shard = v_f.shard
    and last_seen_at > now() - make_interval(secs => public.config_number('presence_seconds', 60)::int);
  if v_n >= v_cap then raise exception 'room full'; end if;

  update public.player_state set shard = v_f.shard, updated_at = now() where player_id = v_me;
  return public.game_dynamic(v_me);
end $$;

create or replace function public.set_share_location(p_user_id uuid, p_share boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  update public.players set share_location = p_share where id = v_me;
  return public.game_dynamic(v_me);
end $$;

-- =====================================================
-- Who you see: active friends, plus a few nearby strangers who share their location
-- =====================================================
create or replace function public.world_snapshot(p_user_id uuid, p_since bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_loc uuid; v_shard int; v_uni uuid; v_win interval;
        v_friends int; v_strangers int; v_count record;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('snapshot:u:' || p_user_id, 40, 60) then
    raise exception 'slow down';
  end if;

  update public.player_state set last_seen_at = now()
  where player_id = v_me
  returning location_id, shard into v_loc, v_shard;
  if v_loc is null then raise exception 'not enrolled'; end if;
  select university_id into v_uni from public.locations where id = v_loc;

  v_win := make_interval(secs => public.config_number('presence_seconds', 60)::int);
  v_friends := public.config_number('visible_friends', 30)::int;
  v_strangers := public.config_number('visible_strangers', 10)::int;

  -- Cached count of everyone online on this campus (recounted at most every 30 seconds).
  select online, updated_at into v_count from public.presence_counts where university_id = v_uni;
  if not found or v_count.updated_at < now() - interval '30 seconds' then
    insert into public.presence_counts (university_id, online, updated_at)
    values (v_uni, (select count(*) from public.locations l
                    join public.player_state s on s.location_id = l.id and s.last_seen_at > now() - v_win
                    where l.university_id = v_uni), now())
    on conflict (university_id) do update set online = excluded.online, updated_at = now()
    returning online, updated_at into v_count;
  end if;

  return jsonb_build_object(
    'people', coalesce((
      with friends as (
        -- Active friends anywhere on campus (starts from my friends list, not from everyone).
        select s.player_id, s.location_id, s.shard, s.asleep_since, s.busy_until, s.busy_activity,
               s.last_seen_at, true as is_friend
        from public.friendships f
        join public.player_state s
          on s.player_id = case when f.player_a = v_me then f.player_b else f.player_a end
        join public.locations l on l.id = s.location_id and l.university_id = v_uni
        where (f.player_a = v_me or f.player_b = v_me) and f.status = 'accepted'
          and s.last_seen_at > now() - v_win
        order by s.last_seen_at desc
        limit v_friends
      ),
      candidates as (
        -- A few of the most recently active people at each place (my place first).
        select x.player_id, x.location_id, x.shard, x.asleep_since, x.busy_until, x.busy_activity,
               x.last_seen_at, false as is_friend
        from public.locations l2
        cross join lateral (
          select s.* from public.player_state s
          where s.location_id = l2.id and s.last_seen_at > now() - v_win
          order by (s.shard = v_shard and s.location_id = v_loc) desc, s.last_seen_at desc
          limit case when l2.id = v_loc then v_strangers * 3 else v_strangers end
        ) x
        where l2.university_id = v_uni
      ),
      strangers as (
        select c.* from candidates c
        join public.players pl on pl.id = c.player_id
        where c.player_id <> v_me and pl.share_location
          and not exists (select 1 from friends f where f.player_id = c.player_id)
          and not public.are_friends(v_me, c.player_id)
        order by (c.location_id = v_loc and c.shard = v_shard) desc, (c.location_id = v_loc) desc,
                 c.last_seen_at desc
        limit v_strangers
      ),
      shown as (select * from friends union all select * from strangers)
      select jsonb_agg(jsonb_build_object(
               'id', pl.id, 'name', pl.display_name,
               'skin', pl.avatar_skin, 'hair_style', pl.avatar_hair_style,
               'hair_color', pl.avatar_hair_color, 'outfit', pl.avatar_outfit,
               'location_kind', l.kind, 'room', sh.shard,
               'same_room', sh.location_id = v_loc and sh.shard = v_shard,
               'friend', sh.is_friend,
               'asleep', sh.asleep_since is not null,
               'activity', case when sh.busy_until > now() then sh.busy_activity end,
               'bond', coalesce(r.bond, 0))
             order by sh.is_friend desc, sh.last_seen_at desc)
      from shown sh
      join public.players pl on pl.id = sh.player_id
      join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
      join public.locations l on l.id = sh.location_id
      left join public.relationships r
        on r.player_a = least(v_me, pl.id) and r.player_b = greatest(v_me, pl.id)
      where not public.blocked_between(v_me, pl.id)), '[]'::jsonb),
    'counts', jsonb_build_object(
      'online', v_count.online,
      'here', (select count(*) from (select 1 from public.player_state s
               where s.location_id = v_loc and s.last_seen_at > now() - v_win limit 1000) h),
      'rooms_here', (select count(distinct x.shard) from (select s.shard from public.player_state s
                     where s.location_id = v_loc and s.last_seen_at > now() - v_win limit 1000) x)),
    'room', v_shard,
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
        where ev.location_id = v_loc and ev.shard = v_shard
          and ev.id > coalesce(p_since, 0)
          and ev.created_at > now() - interval '10 minutes'
          and not public.blocked_between(v_me, ev.actor_id)
        order by ev.id desc
        limit 30
      ) q), '[]'::jsonb),
    'location_kind', (select kind from public.locations where id = v_loc),
    'server_time', now()
  );
end $$;

-- =====================================================
-- Talking and interacting only reach people in your room
-- =====================================================
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
  insert into public.place_events (location_id, shard, actor_id, kind, body)
  values (v_s.location_id, v_s.shard, v_player, 'message', v_text)
  returning id into v_id;

  return jsonb_build_object('event_id', v_id);
end $$;

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

  perform 1 from public.player_state
  where player_id in (v_player, p_target) order by player_id for update;

  select * into v_s from public.player_state where player_id = v_player;
  select * into v_t from public.player_state where player_id = p_target;
  if not found then raise exception 'not here'; end if;

  -- Blocked, banned, elsewhere, in another room, offline, or hidden from strangers: "not here".
  if not exists (select 1 from public.players pl
                 join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
                 where pl.id = p_target
                   and (pl.share_location or public.are_friends(v_player, p_target)))
     or v_t.location_id is distinct from v_s.location_id
     or v_t.shard is distinct from v_s.shard
     or v_t.last_seen_at < now() - make_interval(secs => public.config_number('presence_seconds', 60)::int)
     or public.blocked_between(v_player, p_target) then
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

  perform public.bump_bond(v_player, p_target, v_type.bond_delta);

  insert into public.place_events (location_id, shard, actor_id, target_id, kind)
  values (v_s.location_id, v_s.shard, v_player, p_target, v_type.slug)
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
        update public.player_state set location_id = v_gate, shard = public.room_for(v_player, v_gate)
        where player_id = v_player;
        insert into public.place_events (location_id, shard, actor_id, kind)
        values (v_s.location_id, v_s.shard, v_player, 'thrown_out');
        v_thrown := true;
      end if;
    end if;
  end if;

  if random() < 0.01 then
    delete from public.place_events where created_at < now() - interval '2 days';
  end if;

  return public.game_dynamic(v_player)
    || jsonb_build_object('event_id', v_event, 'thrown_out', v_thrown);
end $$;

-- =====================================================
-- Who may call what
-- =====================================================
revoke all on function public.assign_hostel_room(uuid) from public, anon, authenticated;
-- (presence_counts is only touched by world_snapshot)
revoke all on function public.pick_shard(uuid, uuid) from public, anon, authenticated;
revoke all on function public.room_for(uuid, uuid) from public, anon, authenticated;
revoke all on function public.join_friend_room(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_share_location(uuid, boolean) from public, anon, authenticated;
grant execute on function public.join_friend_room(uuid, uuid) to service_role;
grant execute on function public.set_share_location(uuid, boolean) to service_role;

-- Existing students who are at the hostel right now get their own room straight away.
do $$
declare r record;
begin
  for r in
    select s.player_id from public.player_state s
    join public.locations l on l.id = s.location_id
    join public.enrollments e on e.player_id = s.player_id and e.status = 'active'
    where l.kind = 'hostel'
  loop
    update public.player_state set shard = public.assign_hostel_room(r.player_id)
    where player_id = r.player_id;
  end loop;
end $$;
