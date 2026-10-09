-- CAMPUS LIFE: Stage 19 - "People you may know" friend suggestions
-- Up to 10 suggestions at a time, each with a reason: mutual friends, your roommates,
-- your course and level, people you have hung out with, then other active students at
-- your university. Safety rules:
--   * players can turn off "Show me in friend suggestions"
--   * blocked people never appear, either way; "Not interested" hides someone for good
--   * players aged 18+ and under-18 players are never suggested to each other
--   * at most 20 new friend requests a day (plus the existing 30 an hour)
-- The list is worked out only when someone opens it. Safe to run more than once.

insert into public.app_config (key, value) values ('friend_requests_per_day', '20')
on conflict (key) do nothing;

alter table public.players add column if not exists discoverable boolean not null default true;

create table if not exists public.suggestion_dismissals (
  player_id uuid not null references public.players (id) on delete cascade,
  target_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, target_id)
);
alter table public.suggestion_dismissals enable row level security;
revoke all on public.suggestion_dismissals from anon, authenticated;

create index if not exists enrollments_course_idx on public.enrollments (course_id, status);
create index if not exists players_hostel_room_uni_idx on public.players (hostel_room);
create index if not exists friendships_requested_idx on public.friendships (requested_by, created_at desc);

create or replace function public.get_suggestions(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_uni uuid; v_course uuid; v_level int; v_room int; v_adult boolean; v_disc boolean;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('suggest:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;

  select e.university_id, e.course_id, e.level_year into v_uni, v_course, v_level
  from public.enrollments e where e.player_id = v_me and e.status = 'active';
  select hostel_room, age >= 18, discoverable into v_room, v_adult, v_disc from public.players where id = v_me;
  if v_uni is null then
    return jsonb_build_object('discoverable', v_disc, 'suggestions', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'discoverable', v_disc,
    'suggestions', coalesce((
      with my_friends as (
        select case when f.player_a = v_me then f.player_b else f.player_a end as id
        from public.friendships f
        where (f.player_a = v_me or f.player_b = v_me) and f.status = 'accepted'
      ),
      -- A few candidates from each source (bounded, so this stays fast with many players).
      cand as (
        (select p.id, 'roommate' as src from public.players p
         join public.enrollments e on e.player_id = p.id and e.status = 'active' and e.university_id = v_uni
         where v_room is not null and p.hostel_room = v_room and p.id <> v_me limit 10)
        union all
        (select e.player_id, 'course' from public.enrollments e
         where e.status = 'active' and e.university_id = v_uni and e.course_id = v_course and e.player_id <> v_me
         order by (e.level_year = v_level) desc, e.enrolled_at desc limit 40)
        union all
        (select case when f2.player_a = mf.id then f2.player_b else f2.player_a end, 'mutual'
         from my_friends mf
         join public.friendships f2 on (f2.player_a = mf.id or f2.player_b = mf.id) and f2.status = 'accepted'
         limit 300)
        union all
        (select case when r.player_a = v_me then r.player_b else r.player_a end, 'met'
         from public.relationships r
         where (r.player_a = v_me or r.player_b = v_me) and r.bond > 0
         order by r.last_interaction_at desc limit 30)
        union all
        (select s.player_id, 'campus' from public.player_state s
         join public.locations l on l.id = s.location_id and l.university_id = v_uni
         where s.player_id <> v_me
         order by s.last_seen_at desc limit 40)
      ),
      scored as (
        select c.id,
               count(*) filter (where c.src = 'mutual') as mutual,
               bool_or(c.src = 'roommate') as roommate,
               bool_or(c.src = 'course') as course,
               bool_or(c.src = 'met') as met
        from cand c group by c.id
      ),
      ranked as (
        select sc.*, pl.display_name, pl.avatar_skin, pl.avatar_hair_style, pl.avatar_hair_color,
               pl.avatar_outfit, pl.created_at, e.level_year, co.name as course_name,
               (e.level_year = v_level) as same_level,
               sc.mutual * 5 + sc.roommate::int * 6 + sc.course::int * 4
                 + (sc.course and e.level_year = v_level)::int * 2 + sc.met::int * 5 as score
        from scored sc
        join public.players pl on pl.id = sc.id
        join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
        join public.enrollments e on e.player_id = pl.id and e.status = 'active' and e.university_id = v_uni
        join public.courses co on co.id = e.course_id
        where sc.id <> v_me
          and pl.discoverable
          and (pl.age >= 18) = v_adult
          and not exists (select 1 from public.friendships f
                          where f.player_a = least(v_me, sc.id) and f.player_b = greatest(v_me, sc.id))
          and not exists (select 1 from public.suggestion_dismissals d where d.player_id = v_me and d.target_id = sc.id)
          and not public.blocked_between(v_me, sc.id)
        order by score desc, pl.created_at desc
        limit 10
      )
      select jsonb_agg(jsonb_build_object(
               'id', x.id, 'name', x.display_name,
               'skin', x.avatar_skin, 'hair_style', x.avatar_hair_style,
               'hair_color', x.avatar_hair_color, 'outfit', x.avatar_outfit,
               'level_year', x.level_year, 'course', x.course_name,
               'reason', case
                 when x.mutual > 1 then x.mutual || ' mutual friends'
                 when x.mutual = 1 then '1 mutual friend'
                 when x.roommate then 'Lives in your hostel room'
                 when x.course and x.same_level then 'Same course and level as you'
                 when x.course then 'Studies ' || x.course_name || ' too'
                 when x.met then 'You hung out together'
                 else 'Also at your university' end)
             order by x.score desc, x.created_at desc)
      from ranked x), '[]'::jsonb)
  );
end $$;

create or replace function public.dismiss_suggestion(p_user_id uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('suggest:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  if p_target = v_me then return; end if;
  insert into public.suggestion_dismissals (player_id, target_id) values (v_me, p_target)
  on conflict do nothing;
end $$;

create or replace function public.set_discoverable(p_user_id uuid, p_on boolean)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  update public.players set discoverable = coalesce(p_on, true) where id = v_me;
  return coalesce(p_on, true);
end $$;

-- ---------- Friend requests: at most 20 new ones a day ----------

create or replace function public.friend_request(p_user_id uuid, p_target uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_row public.friendships%rowtype; v_name text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('friend:u:' || p_user_id, 30, 3600) then raise exception 'slow down'; end if;
  if p_target = v_me then raise exception 'not yourself'; end if;
  if not exists (select 1 from public.players pl join public.profiles pr on pr.id = pl.user_id
                 where pl.id = p_target and pr.status = 'active')
     or public.blocked_between(v_me, p_target) then
    raise exception 'unknown player';
  end if;

  select * into v_row from public.friendships
  where player_a = least(v_me, p_target) and player_b = greatest(v_me, p_target) for update;

  if found then
    if v_row.status = 'accepted' then return 'already friends'; end if;
    if v_row.requested_by = v_me then return 'already sent'; end if;
    -- They had already asked me: this accepts.
    update public.friendships set status = 'accepted', accepted_at = now()
    where player_a = v_row.player_a and player_b = v_row.player_b;
    select display_name into v_name from public.players where id = v_me;
    insert into public.notifications (player_id, kind, title)
    values (p_target, 'friend_accepted', v_name || ' accepted your friend request');
    return 'accepted';
  end if;

  if (select count(*) from public.friendships
      where (player_a = v_me or player_b = v_me) and status = 'accepted') >= 500 then
    raise exception 'too many friends';
  end if;

  -- No spamming everyone: a daily cap on new requests.
  if (select count(*) from public.friendships
      where requested_by = v_me and created_at > now() - interval '24 hours')
     >= public.config_number('friend_requests_per_day', 20) then
    raise exception 'too many requests today';
  end if;

  insert into public.friendships (player_a, player_b, status, requested_by)
  values (least(v_me, p_target), greatest(v_me, p_target), 'pending', v_me);

  select display_name into v_name from public.players where id = v_me;
  insert into public.notifications (player_id, kind, title)
  values (p_target, 'friend_request', v_name || ' sent you a friend request');
  return 'sent';
end $$;

revoke all on function public.get_suggestions(uuid) from public, anon, authenticated;
revoke all on function public.dismiss_suggestion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_discoverable(uuid, boolean) from public, anon, authenticated;
grant execute on function public.get_suggestions(uuid) to service_role;
grant execute on function public.dismiss_suggestion(uuid, uuid) to service_role;
grant execute on function public.set_discoverable(uuid, boolean) to service_role;
