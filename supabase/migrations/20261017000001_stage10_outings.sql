-- CAMPUS LIFE: Stage 10 - outings with friends, shorter shifts
-- Invite friends to eat, play football or hang out together. The host chooses to pay for
-- everyone or everyone pays for themselves; a friend who is treated is told who paid.
-- Job shifts now last 3 to 5 minutes. Safe to run more than once.

-- ---------- Shorter job shifts and visible meals and sports ----------

alter table public.jobs drop constraint if exists jobs_shift_minutes_check;
alter table public.jobs add constraint jobs_shift_minutes_check check (shift_minutes between 1 and 480);

update public.jobs j set shift_minutes = v.m
from (values ('hostel_errands', 3), ('cafeteria_server', 3), ('library_assistant', 3),
             ('pos_agent', 4), ('fitness_coach', 4),
             ('campus_tutor', 5), ('club_bartender', 5), ('pharmacy_attendant', 5)) as v (slug, m)
where j.slug = v.slug;

update public.activities a set duration_minutes = v.m
from (values ('cafeteria_meal', 3), ('street_food', 2), ('bread_and_tea', 2), ('snacks', 1),
             ('pickup_football', 4), ('light_workout', 3)) as v (slug, m)
where a.slug = v.slug;

insert into public.app_config (key, value) values
  ('outing_max_guests', '7'),
  ('outing_minutes', '15')
on conflict (key) do nothing;

-- ---------- Outings ----------

create table if not exists public.outings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.players (id) on delete cascade,
  activity_slug text not null references public.activities (slug),
  location_id uuid not null references public.locations (id) on delete cascade,
  shard integer not null default 1,
  host_pays boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.outings enable row level security;
revoke all on public.outings from anon, authenticated;
create index if not exists outings_host_idx on public.outings (host_id, created_at desc);

create table if not exists public.outing_members (
  outing_id uuid not null references public.outings (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  paid_by uuid references public.players (id) on delete set null,
  responded_at timestamptz,
  primary key (outing_id, player_id)
);
alter table public.outing_members enable row level security;
revoke all on public.outing_members from anon, authenticated;
create index if not exists outing_members_player_idx on public.outing_members (player_id, status);

-- Starts an activity for a player, charging whoever pays. Callers check who may do this.
create or replace function public.apply_activity(p_player uuid, p_slug text, p_payer uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_s public.player_state%rowtype; v_act public.activities%rowtype; v_kind text; v_name text;
begin
  select * into v_s from public.player_state where player_id = p_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;

  select * into v_act from public.activities where slug = p_slug and is_active;
  if not found or v_act.ends_day then raise exception 'unknown activity'; end if;

  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind is distinct from v_act.location_kind then raise exception 'wrong place'; end if;

  if exists (select 1 from public.player_cooldowns
             where player_id = p_player and activity_slug = v_act.slug and available_at > now()) then
    raise exception 'cooldown';
  end if;
  if v_act.energy_delta < 0 and v_s.energy < -v_act.energy_delta then raise exception 'too tired'; end if;

  if v_act.cost_kobo > 0 then
    if p_payer = p_player then
      perform public.wallet_apply(p_player, -v_act.cost_kobo, 'activity', v_act.name);
    else
      select display_name into v_name from public.players where id = p_player;
      perform public.wallet_apply(p_payer, -v_act.cost_kobo, 'treat',
        v_act.name || ' for ' || v_name, 'game', null, p_player);
    end if;
  end if;

  update public.player_state set
    energy = greatest(0, least(100, energy + v_act.energy_delta)),
    health = greatest(0, least(100, health + v_act.health_delta)),
    happiness = greatest(0, least(100, happiness + v_act.happiness_delta)),
    busy_until = now() + make_interval(secs => (v_act.duration_minutes * 60)::double precision),
    busy_activity = v_act.slug,
    updated_at = now()
  where player_id = p_player;

  if v_act.cooldown_minutes > 0 then
    insert into public.player_cooldowns (player_id, activity_slug, available_at)
    values (p_player, v_act.slug, now() + make_interval(mins => v_act.cooldown_minutes))
    on conflict (player_id, activity_slug) do update set available_at = excluded.available_at;
  end if;
end $$;

-- The host starts the activity and invites friends to join.
create or replace function public.create_outing(
  p_user_id uuid, p_activity text, p_friends uuid[], p_host_pays boolean
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_s public.player_state%rowtype; v_act public.activities%rowtype;
  v_n int; v_friend uuid; v_id uuid; v_name text; v_place text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('outing:u:' || p_user_id, 10, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select * into v_act from public.activities where slug = p_activity and is_active;
  if not found or v_act.ends_day then raise exception 'unknown activity'; end if;

  select count(distinct f) into v_n from unnest(p_friends) f where f is not null and f <> v_me;
  if v_n < 1 then raise exception 'outing: pick friends'; end if;
  if v_n > public.config_number('outing_max_guests', 7)::int then raise exception 'outing: too many'; end if;
  foreach v_friend in array p_friends loop
    if v_friend is null or v_friend = v_me then continue; end if;
    if not public.are_friends(v_me, v_friend) or public.blocked_between(v_me, v_friend) then
      raise exception 'not friends';
    end if;
  end loop;

  if p_host_pays and not exists (select 1 from public.wallets
                                 where player_id = v_me and balance_kobo >= v_act.cost_kobo * (v_n + 1)) then
    raise exception 'not enough money';
  end if;

  perform public.apply_activity(v_me, v_act.slug, v_me);

  select * into v_s from public.player_state where player_id = v_me;
  insert into public.outings (host_id, activity_slug, location_id, shard, host_pays, expires_at)
  values (v_me, v_act.slug, v_s.location_id, v_s.shard, p_host_pays and v_act.cost_kobo > 0,
          now() + make_interval(mins => public.config_number('outing_minutes', 15)::int))
  returning id into v_id;

  select display_name into v_name from public.players where id = v_me;
  select name into v_place from public.locations where id = v_s.location_id;
  insert into public.outing_members (outing_id, player_id)
  select distinct v_id, f from unnest(p_friends) f where f is not null and f <> v_me;

  insert into public.notifications (player_id, kind, title, body, data)
  select distinct f, 'outing', '👥 ' || v_name || ' invited you: ' || v_act.name,
         'At ' || v_place || ' · ' ||
         case when p_host_pays and v_act.cost_kobo > 0 then v_name || ' is paying'
              when v_act.cost_kobo > 0 then 'Everyone pays for themselves'
              else 'Free' end,
         jsonb_build_object('outing_id', v_id)
  from unnest(p_friends) f where f is not null and f <> v_me;

  return public.game_dynamic(v_me) || jsonb_build_object('outing_id', v_id);
end $$;

-- A friend says yes (they go there and join in) or no.
create or replace function public.respond_outing(p_user_id uuid, p_outing uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_o public.outings%rowtype; v_act public.activities%rowtype; v_payer uuid;
  v_me_name text; v_host_name text; v_loc uuid; v_kind text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('outing:u:' || p_user_id, 10, 60) then raise exception 'slow down'; end if;

  perform 1 from public.outing_members
  where outing_id = p_outing and player_id = v_me and status = 'invited' for update;
  if not found then raise exception 'outing: no invite'; end if;
  select * into v_o from public.outings where id = p_outing;
  if v_o.expires_at < now() or public.blocked_between(v_me, v_o.host_id) then
    raise exception 'outing: expired';
  end if;

  if not p_accept then
    update public.outing_members set status = 'declined', responded_at = now()
    where outing_id = p_outing and player_id = v_me;
    return public.game_dynamic(v_me);
  end if;

  perform public.sync_player_state(v_me);
  select location_id into v_loc from public.player_state where player_id = v_me;
  if v_loc is distinct from v_o.location_id then
    perform public.travel_to(p_user_id, v_o.location_id);
  end if;
  -- Join the host's room at that place.
  update public.player_state set shard = v_o.shard where player_id = v_me;

  select * into v_act from public.activities where slug = v_o.activity_slug;
  v_payer := v_me;
  if v_o.host_pays and v_act.cost_kobo > 0
     and exists (select 1 from public.wallets where player_id = v_o.host_id and balance_kobo >= v_act.cost_kobo) then
    v_payer := v_o.host_id;
  end if;
  perform public.apply_activity(v_me, v_act.slug, v_payer);

  update public.outing_members set status = 'joined', paid_by = v_payer, responded_at = now()
  where outing_id = p_outing and player_id = v_me;

  -- Doing things together is better: a little happiness for both and a closer bond.
  update public.player_state set happiness = least(100, happiness + 3)
  where player_id in (v_me, v_o.host_id);
  perform public.bump_bond(v_me, v_o.host_id, 3);

  select display_name into v_me_name from public.players where id = v_me;
  select display_name into v_host_name from public.players where id = v_o.host_id;
  if v_payer = v_o.host_id then
    insert into public.notifications (player_id, kind, title, body)
    values (v_me, 'treat', '💚 ' || v_host_name || ' paid for your ' || v_act.name,
            v_host_name || ' paid ₦' || to_char(v_act.cost_kobo / 100, 'FM999,999,990') || ' for you.');
  end if;
  insert into public.notifications (player_id, kind, title, body)
  values (v_o.host_id, 'outing', '👥 ' || v_me_name || ' joined your ' || v_act.name,
          case when v_payer = v_o.host_id
               then 'You paid ₦' || to_char(v_act.cost_kobo / 100, 'FM999,999,990') || ' for them.'
               when v_o.host_pays then 'You could not afford to pay, so they paid for themselves.'
               else null end);

  select kind into v_kind from public.locations where id = v_o.location_id;
  return public.game_dynamic(v_me)
    || jsonb_build_object('outing_kind', v_kind, 'paid_by_host', v_payer = v_o.host_id);
end $$;

-- ---------- Invitations show up with the other badges ----------

create or replace function public.social_badges(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  return jsonb_build_object(
    'unread_chats', (
      select count(*) from public.conversation_members cm
      where cm.player_id = v_me and not cm.muted
        and exists (select 1 from public.messages m
                    where m.conversation_id = cm.conversation_id and m.id > cm.last_read_id
                      and m.sender_id <> v_me
                      and not exists (select 1 from public.player_mutes pm where pm.muter_id = v_me and pm.muted_id = m.sender_id)
                      and not public.blocked_between(v_me, m.sender_id))),
    'friend_requests', (
      select count(*) from public.friendships
      where (player_a = v_me or player_b = v_me) and status = 'pending' and requested_by <> v_me),
    'dating_asks', (
      select count(*) from public.romances
      where status = 'asked' and asked_by <> v_me and (player_a = v_me or player_b = v_me)),
    'friend_ids', coalesce((
      select jsonb_agg(case when player_a = v_me then player_b else player_a end)
      from public.friendships where (player_a = v_me or player_b = v_me) and status = 'accepted'), '[]'::jsonb),
    'pending_ids', coalesce((
      select jsonb_agg(case when player_a = v_me then player_b else player_a end)
      from public.friendships where (player_a = v_me or player_b = v_me) and status = 'pending'), '[]'::jsonb),
    'outings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', o.id, 'host_id', o.host_id, 'host', h.display_name,
               'activity', a.name, 'activity_slug', a.slug, 'cost_kobo', a.cost_kobo,
               'place', l.name, 'place_kind', l.kind,
               'host_pays', o.host_pays, 'expires_at', o.expires_at) order by o.created_at desc)
      from public.outing_members m
      join public.outings o on o.id = m.outing_id
      join public.players h on h.id = o.host_id
      join public.activities a on a.slug = o.activity_slug
      join public.locations l on l.id = o.location_id
      where m.player_id = v_me and m.status = 'invited' and o.expires_at > now()
        and not public.blocked_between(v_me, o.host_id)), '[]'::jsonb)
  );
end $$;

revoke all on function public.apply_activity(uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_outing(uuid, text, uuid[], boolean) from public, anon, authenticated;
revoke all on function public.respond_outing(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.create_outing(uuid, text, uuid[], boolean) to service_role;
grant execute on function public.respond_outing(uuid, uuid, boolean) to service_role;
