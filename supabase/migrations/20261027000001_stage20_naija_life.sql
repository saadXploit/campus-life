-- CAMPUS LIFE: Stage 20 - friends together, rankings, Naija life events
--   * Friends at the same place always end up in the same room, even when it is busy
--     (up to 10 extra people), so they always see each other.
--   * Rankings: richest students, top CGPA and most friends at your university.
--   * Naija life events: every few hours real life happens (black tax, NEPA, allowance,
--     a fake credit alert...) and the player chooses what to do.
-- Safe to run more than once.

insert into public.app_config (key, value) values
  ('friend_room_overflow', '10'),
  ('life_event_hours', '4'),
  ('life_event_chance_percent', '60')
on conflict (key) do nothing;

-- ---------- 1. Friends always share a room ----------

create or replace function public.pick_shard(p_player uuid, p_location uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_cap int; v_win interval; v_shard int;
begin
  v_cap := public.config_number('room_capacity', 25)::int;
  v_win := make_interval(secs => public.config_number('presence_seconds', 60)::int);

  -- A room with a friend in it, even if it is a little over the normal size.
  with counts as (
    select s.shard, count(*) as n from public.player_state s
    where s.location_id = p_location and s.last_seen_at > now() - v_win and s.player_id <> p_player
    group by s.shard
  ),
  friend_rooms as (
    select c.shard, c.n, count(*) as friends
    from counts c
    join public.player_state s on s.location_id = p_location and s.shard = c.shard
                                and s.last_seen_at > now() - v_win
    join public.friendships f on f.status = 'accepted'
      and f.player_a = least(p_player, s.player_id) and f.player_b = greatest(p_player, s.player_id)
    group by c.shard, c.n
  )
  select fr.shard into v_shard from friend_rooms fr
  where fr.n < v_cap + public.config_number('friend_room_overflow', 10)::int
  order by fr.friends desc, fr.n desc limit 1;
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

-- Joining a friend's room may also go a little over the normal size.
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
                then public.config_number('hostel_room_size', 4)::int + 2
                else public.config_number('room_capacity', 25)::int
                     + public.config_number('friend_room_overflow', 10)::int end;
  select count(*) into v_n from public.player_state
  where location_id = v_s.location_id and shard = v_f.shard
    and last_seen_at > now() - make_interval(secs => public.config_number('presence_seconds', 60)::int);
  if v_n >= v_cap then raise exception 'room full'; end if;

  update public.player_state set shard = v_f.shard, updated_at = now() where player_id = v_me;
  return public.game_dynamic(v_me);
end $$;

-- ---------- 2. Rankings ----------

create index if not exists wallets_balance_idx on public.wallets (balance_kobo desc);
create index if not exists enrollments_uni_cgpa_idx on public.enrollments (university_id, cgpa desc) where status = 'active';

create or replace function public.get_rankings(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_uni uuid; v_bal bigint; v_cgpa numeric; v_friends int;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('rank:u:' || p_user_id, 10, 60) then raise exception 'slow down'; end if;
  select university_id, cgpa into v_uni, v_cgpa from public.enrollments where player_id = v_me and status = 'active';
  select balance_kobo into v_bal from public.wallets where player_id = v_me;
  select count(*) into v_friends from public.friendships
  where (player_a = v_me or player_b = v_me) and status = 'accepted';

  return jsonb_build_object(
    'richest', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name, 'value', x.balance_kobo, 'me', x.id = v_me) order by x.balance_kobo desc)
      from (select p.id, p.display_name, w.balance_kobo
            from public.enrollments e
            join public.players p on p.id = e.player_id and p.discoverable
            join public.profiles pr on pr.id = p.user_id and pr.status = 'active'
            join public.wallets w on w.player_id = p.id
            where e.university_id = v_uni and e.status = 'active'
            order by w.balance_kobo desc limit 10) x), '[]'::jsonb),
    'top_cgpa', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name, 'value', x.cgpa, 'me', x.id = v_me) order by x.cgpa desc)
      from (select p.id, p.display_name, e.cgpa
            from public.enrollments e
            join public.players p on p.id = e.player_id and p.discoverable
            join public.profiles pr on pr.id = p.user_id and pr.status = 'active'
            where e.university_id = v_uni and e.status = 'active' and e.cgpa is not null
            order by e.cgpa desc, e.total_units desc limit 10) x), '[]'::jsonb),
    'most_friends', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.display_name, 'value', x.n, 'me', x.id = v_me) order by x.n desc)
      from (select p.id, p.display_name, count(f.player_a) as n
            from public.enrollments e
            join public.players p on p.id = e.player_id and p.discoverable
            join public.profiles pr on pr.id = p.user_id and pr.status = 'active'
            join public.friendships f on f.status = 'accepted' and (f.player_a = p.id or f.player_b = p.id)
            where e.university_id = v_uni and e.status = 'active'
            group by p.id, p.display_name
            order by n desc limit 10) x), '[]'::jsonb),
    'me', jsonb_build_object(
      'balance', v_bal,
      'cgpa', v_cgpa,
      'friends', v_friends,
      'rich_rank', 1 + (select count(*) from public.enrollments e join public.wallets w on w.player_id = e.player_id
                        where e.university_id = v_uni and e.status = 'active' and w.balance_kobo > coalesce(v_bal, 0)),
      'cgpa_rank', case when v_cgpa is null then null else
                   1 + (select count(*) from public.enrollments e
                        where e.university_id = v_uni and e.status = 'active' and e.cgpa > v_cgpa) end)
  );
end $$;

-- ---------- 3. Naija life events ----------

create table if not exists public.life_event_types (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  emoji text not null,
  title text not null check (length(title) between 2 and 80),
  body text not null check (length(body) <= 300),
  -- Who it can happen to: 'all', 'rich' (family with money) or 'poor'.
  audience text not null default 'all' check (audience in ('all', 'rich', 'poor')),
  weight smallint not null default 10 check (weight between 1 and 100),
  -- [{"key","label","money","energy","health","happiness","result"}]; money in kobo (+ in, - out).
  choices jsonb not null,
  is_active boolean not null default true
);
alter table public.life_event_types enable row level security;
revoke all on public.life_event_types from anon, authenticated;

insert into public.life_event_types (slug, emoji, title, body, audience, weight, choices) values
  ('black_tax', '💸', 'Black tax', 'Your cousin back home needs ₦3,000 for school fees. The family group chat is watching.', 'all', 12,
   '[{"key":"send","label":"Send ₦3,000","money":-300000,"happiness":4,"result":"Your aunty sent a long prayer voice note. You feel good."},
     {"key":"sorry","label":"Sorry, I''m broke too","happiness":-4,"result":"The family chat went quiet. You feel a bit guilty."}]'),
  ('allowance_rich', '🎁', 'Daddy sent your allowance', 'A credit alert from home: your monthly allowance has landed.', 'rich', 14,
   '[{"key":"thanks","label":"Thank you, Daddy! 🙏","money":800000,"happiness":5,"result":"₦8,000 received. Enjoy, but don''t waste it."}]'),
  ('allowance_poor', '🎁', 'Mummy sent something small', 'Mummy managed to send you a little money. "Use it well, my child."', 'poor', 10,
   '[{"key":"thanks","label":"Thank you, Mummy ❤️","money":250000,"happiness":6,"result":"₦2,500 received. Every naira counts."}]'),
  ('nepa', '💡', 'NEPA took light', 'No light in the hostel tonight. Your phone is on 5% and the room is hot.', 'all', 12,
   '[{"key":"fuel","label":"Chip in for generator fuel (₦500)","money":-50000,"happiness":2,"result":"The gen came on. Fan, light and charging. Peace."},
     {"key":"endure","label":"Sleep in the heat","happiness":-5,"energy":-5,"result":"Mosquitoes and heat. You barely slept."}]'),
  ('fake_alert', '📱', 'Fake credit alert?', 'Someone texted: "I mistakenly sent you ₦5,000, please send it back." Your bank app shows nothing new.', 'all', 8,
   '[{"key":"check","label":"Check your bank first","happiness":3,"result":"No money came in. It was a scam. Well done for checking!"},
     {"key":"send","label":"Send ₦5,000 back","money":-500000,"happiness":-8,"result":"It was a scam. The money is gone. Always check your bank app first."}]'),
  ('cracked_screen', '📵', 'Cracked screen', 'Your phone slipped and the screen cracked right across.', 'all', 8,
   '[{"key":"fix","label":"Fix it (₦4,000)","money":-400000,"happiness":2,"result":"Good as new."},
     {"key":"manage","label":"Manage it like that","happiness":-6,"result":"Every swipe cuts a little bit of your soul."}]'),
  ('malaria', '🤒', 'Malaria wahala', 'You feel feverish and weak. It might be malaria.', 'all', 8,
   '[{"key":"clinic","label":"Go to the health centre (₦2,000)","money":-200000,"health":15,"result":"Treated properly. You feel much better."},
     {"key":"panadol","label":"Manage with Panadol (₦200)","money":-20000,"health":3,"energy":-8,"result":"You''re managing, but you still feel weak."}]'),
  ('found_money', '💵', 'Money on the floor', 'You found ₦1,000 under a seat in the lecture hall.', 'all', 6,
   '[{"key":"keep","label":"Keep it","money":100000,"result":"Small blessing. ₦1,000 richer."},
     {"key":"return","label":"Hand it to campus security","happiness":6,"result":"Security thanked you. You feel proud of yourself."}]'),
  ('jollof_party', '🍛', 'Jollof party', 'Your roommate is throwing a jollof party in the hostel tonight.', 'all', 8,
   '[{"key":"contribute","label":"Contribute ₦1,500","money":-150000,"happiness":8,"energy":5,"result":"Party jollof, music and gist. Best night this week."},
     {"key":"just_eat","label":"Just come and eat","happiness":3,"energy":4,"result":"You ate well. Some people noticed you didn''t contribute."}]'),
  ('handout', '📄', 'Compulsory handout', 'Your lecturer says the handout is "compulsory": ₦2,500.', 'all', 6,
   '[{"key":"buy","label":"Buy it (₦2,500)","money":-250000,"happiness":2,"result":"You have the handout. Exam questions often come from it."},
     {"key":"photocopy","label":"Photocopy a friend''s (₦300)","money":-30000,"result":"Faint copy, but it works."}]')
on conflict (slug) do update set emoji = excluded.emoji, title = excluded.title, body = excluded.body,
  audience = excluded.audience, weight = excluded.weight, choices = excluded.choices;

-- When each player last had a chance of an event (rolled once per window).
alter table public.players add column if not exists life_event_rolled_at timestamptz;

create table if not exists public.player_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  event_slug text not null references public.life_event_types (slug),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  choice text
);
alter table public.player_events enable row level security;
revoke all on public.player_events from anon, authenticated;
create index if not exists player_events_player_idx on public.player_events (player_id, created_at desc);

-- Rich family backgrounds get allowances; others get the smaller one.
create or replace function public.family_audience(p_player uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when b.starting_wallet_kobo >= 6000000 then 'rich' else 'poor' end
  from public.players p join public.backgrounds b on b.slug = p.background_slug where p.id = p_player
$$;

-- Your open event, or maybe a new one if enough time has passed.
create or replace function public.get_life_event(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_last timestamptz; v_open public.player_events%rowtype; v_slug text; v_aud text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('event:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  if not exists (select 1 from public.enrollments where player_id = v_me and status = 'active') then
    return jsonb_build_object('event', null);
  end if;

  select * into v_open from public.player_events where player_id = v_me and resolved_at is null
  order by id desc limit 1;
  if not found then
    -- One roll of the dice per window (default every 4 hours), whatever the result.
    update public.players set life_event_rolled_at = now()
    where id = v_me and (life_event_rolled_at is null
      or life_event_rolled_at < now() - make_interval(hours => public.config_number('life_event_hours', 4)::int))
    returning life_event_rolled_at into v_last;
    if v_last is not null and random() * 100 < public.config_number('life_event_chance_percent', 60) then
      v_aud := coalesce(public.family_audience(v_me), 'poor');
      -- Pick by weight, never the same event twice in a row.
      select t.slug into v_slug from public.life_event_types t
      where t.is_active and t.audience in ('all', v_aud)
        and t.slug is distinct from (select event_slug from public.player_events where player_id = v_me order by id desc limit 1)
      order by -ln(greatest(random(), 1e-9)) / t.weight limit 1;
      if v_slug is not null then
        insert into public.player_events (player_id, event_slug) values (v_me, v_slug) returning * into v_open;
      end if;
    end if;
  end if;

  if v_open.id is null then return jsonb_build_object('event', null); end if;
  return jsonb_build_object('event', (
    select jsonb_build_object('id', v_open.id, 'slug', t.slug, 'emoji', t.emoji, 'title', t.title,
                              'body', t.body, 'choices', t.choices)
    from public.life_event_types t where t.slug = v_open.event_slug));
end $$;

-- Choose what to do.
create or replace function public.resolve_life_event(p_user_id uuid, p_event bigint, p_choice text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_ev public.player_events%rowtype; v_t public.life_event_types%rowtype; v_c jsonb; v_money bigint;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('event:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  select * into v_ev from public.player_events where id = p_event and player_id = v_me for update;
  if not found or v_ev.resolved_at is not null then raise exception 'event: gone'; end if;
  select * into v_t from public.life_event_types where slug = v_ev.event_slug;
  select c into v_c from jsonb_array_elements(v_t.choices) c where c ->> 'key' = p_choice;
  if v_c is null then raise exception 'event: bad choice'; end if;

  v_money := coalesce((v_c ->> 'money')::bigint, 0);
  if v_money <> 0 then
    perform public.wallet_apply(v_me, v_money, 'life_event', v_t.title || ': ' || (v_c ->> 'label'));
  end if;
  perform public.sync_player_state(v_me);
  update public.player_state set
    energy = greatest(0, least(100, energy + coalesce((v_c ->> 'energy')::int, 0))),
    health = greatest(0, least(100, health + coalesce((v_c ->> 'health')::int, 0))),
    happiness = greatest(0, least(100, happiness + coalesce((v_c ->> 'happiness')::int, 0))),
    updated_at = now()
  where player_id = v_me;
  update public.player_events set resolved_at = now(), choice = p_choice where id = v_ev.id;

  return public.game_dynamic(v_me) || jsonb_build_object('result', v_c ->> 'result');
end $$;

revoke all on function public.get_rankings(uuid) from public, anon, authenticated;
revoke all on function public.family_audience(uuid) from public, anon, authenticated;
revoke all on function public.get_life_event(uuid) from public, anon, authenticated;
revoke all on function public.resolve_life_event(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.get_rankings(uuid) to service_role;
grant execute on function public.get_life_event(uuid) to service_role;
grant execute on function public.resolve_life_event(uuid, bigint, text) to service_role;
