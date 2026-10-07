-- CAMPUS LIFE: Stage 8A - friends, chats, dating, gifts
-- Safe to run more than once.

-- =====================================================
-- Friends
-- =====================================================
create table if not exists public.friendships (
  player_a uuid not null references public.players (id) on delete cascade,
  player_b uuid not null references public.players (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (player_a, player_b),
  check (player_a < player_b)
);
create index if not exists friendships_b_idx on public.friendships (player_b);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create table if not exists public.player_mutes (
  muter_id uuid not null references public.players (id) on delete cascade,
  muted_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table public.player_mutes enable row level security;
revoke all on public.player_mutes from anon, authenticated;

create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.friendships
                 where player_a = least(p_a, p_b) and player_b = greatest(p_a, p_b)
                   and status = 'accepted')
$$;

create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

-- =====================================================
-- Chats: private (friends only), group, and one campus chat per university
-- =====================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group', 'campus')),
  title text check (length(title) between 2 and 40),
  university_id uuid references public.universities (id) on delete cascade,
  direct_key text unique,
  created_by uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'campus') = (university_id is not null)),
  check ((kind = 'direct') = (direct_key is not null))
);
create unique index if not exists conversations_campus_idx
  on public.conversations (university_id) where kind = 'campus';

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_read_id bigint not null default 0,
  muted boolean not null default false,
  primary key (conversation_id, player_id)
);
create index if not exists conversation_members_player_idx on public.conversation_members (player_id);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.players (id) on delete cascade,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, id desc);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;

-- =====================================================
-- Dating (both players opt in, confirm they are adults, and agree) and gifts
-- =====================================================
alter table public.players add column if not exists dating_opt_in boolean not null default false;
alter table public.players add column if not exists adult_confirmed_at timestamptz;

create table if not exists public.romances (
  id uuid primary key default gen_random_uuid(),
  player_a uuid not null references public.players (id) on delete cascade,
  player_b uuid not null references public.players (id) on delete cascade,
  status text not null check (status in ('asked', 'dating', 'ended', 'declined')),
  asked_by uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.players (id) on delete set null,
  end_reason text check (length(end_reason) <= 120),
  check (player_a < player_b)
);
create unique index if not exists romances_open_pair_idx
  on public.romances (player_a, player_b) where status in ('asked', 'dating');
create index if not exists romances_a_idx on public.romances (player_a);
create index if not exists romances_b_idx on public.romances (player_b);
alter table public.romances enable row level security;
revoke all on public.romances from anon, authenticated;

create table if not exists public.gift_types (
  slug text primary key check (slug ~ '^[a-z_]{2,30}$'),
  name text not null,
  emoji text not null,
  cost_kobo bigint not null check (cost_kobo > 0),
  bond_delta smallint not null check (bond_delta between 0 and 30),
  happiness_delta smallint not null check (happiness_delta between 0 and 20),
  romantic boolean not null default false,
  sort_order smallint not null default 0
);
alter table public.gift_types enable row level security;
revoke all on public.gift_types from anon, authenticated;

insert into public.gift_types (slug, name, emoji, cost_kobo, bond_delta, happiness_delta, romantic, sort_order)
values
  ('suya', 'Suya', '🍢', 100000, 3, 3, false, 1),
  ('chocolate', 'Chocolate', '🍫', 150000, 4, 4, false, 2),
  ('book', 'A good book', '📘', 300000, 4, 2, false, 3),
  ('flowers', 'Flowers', '💐', 200000, 6, 5, true, 4),
  ('teddy', 'Teddy bear', '🧸', 500000, 8, 6, true, 5),
  ('perfume', 'Perfume', '🌸', 1200000, 12, 8, true, 6)
on conflict (slug) do nothing;

create table if not exists public.gifts (
  id bigint generated always as identity primary key,
  from_id uuid not null references public.players (id) on delete cascade,
  to_id uuid not null references public.players (id) on delete cascade,
  gift_slug text not null references public.gift_types (slug),
  cost_kobo bigint not null,
  note text check (length(note) <= 80),
  idempotency_key text not null check (length(idempotency_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (from_id, idempotency_key)
);
create index if not exists gifts_to_idx on public.gifts (to_id, created_at desc);
alter table public.gifts enable row level security;
revoke all on public.gifts from anon, authenticated;

-- Adds to the bond between two players (creates the pair if needed).
create or replace function public.bump_bond(p_a uuid, p_b uuid, p_delta int)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.relationships (player_a, player_b, bond, interactions)
  values (least(p_a, p_b), greatest(p_a, p_b), greatest(-100, least(100, p_delta)), 1)
  on conflict (player_a, player_b) do update set
    bond = greatest(-100, least(100, public.relationships.bond + p_delta)),
    interactions = public.relationships.interactions + 1,
    last_interaction_at = now()
$$;

create or replace function public.current_partner(p_player uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case when player_a = p_player then player_b else player_a end
  from public.romances
  where status = 'dating' and (player_a = p_player or player_b = p_player)
  limit 1
$$;

-- =====================================================
-- Friend requests
-- =====================================================
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

  insert into public.friendships (player_a, player_b, status, requested_by)
  values (least(v_me, p_target), greatest(v_me, p_target), 'pending', v_me);

  select display_name into v_name from public.players where id = v_me;
  insert into public.notifications (player_id, kind, title)
  values (p_target, 'friend_request', v_name || ' sent you a friend request');
  return 'sent';
end $$;

create or replace function public.respond_friend(p_user_id uuid, p_from uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_name text;
begin
  v_me := public.active_player_id(p_user_id);
  if not exists (select 1 from public.friendships
                 where player_a = least(v_me, p_from) and player_b = greatest(v_me, p_from)
                   and status = 'pending' and requested_by = p_from) then
    raise exception 'no request';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
    where player_a = least(v_me, p_from) and player_b = greatest(v_me, p_from);
    select display_name into v_name from public.players where id = v_me;
    insert into public.notifications (player_id, kind, title)
    values (p_from, 'friend_accepted', v_name || ' accepted your friend request');
  else
    delete from public.friendships
    where player_a = least(v_me, p_from) and player_b = greatest(v_me, p_from);
  end if;
end $$;

-- Unfriending (or cancelling a request). Unfriending your partner also ends the relationship.
create or replace function public.remove_friend(p_user_id uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  delete from public.friendships
  where player_a = least(v_me, p_target) and player_b = greatest(v_me, p_target);
  update public.romances set status = 'ended', ended_at = now(), ended_by = v_me, end_reason = 'Unfriended'
  where player_a = least(v_me, p_target) and player_b = greatest(v_me, p_target)
    and status in ('asked', 'dating');
end $$;

create or replace function public.mute_player(p_user_id uuid, p_target uuid, p_mute boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if p_target = v_me then raise exception 'not yourself'; end if;
  if p_mute then
    insert into public.player_mutes (muter_id, muted_id) values (v_me, p_target) on conflict do nothing;
  else
    delete from public.player_mutes where muter_id = v_me and muted_id = p_target;
  end if;
end $$;

-- =====================================================
-- Opening chats
-- =====================================================
create or replace function public.campus_conversation(p_uni uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from public.conversations where kind = 'campus' and university_id = p_uni;
  if v_id is null then
    insert into public.conversations (kind, title, university_id)
    values ('campus', 'Campus chat', p_uni)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.conversations where kind = 'campus' and university_id = p_uni;
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.open_direct(p_user_id uuid, p_friend uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_key text; v_id uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.are_friends(v_me, p_friend) then raise exception 'not friends'; end if;
  if public.blocked_between(v_me, p_friend) then raise exception 'not friends'; end if;

  v_key := least(v_me, p_friend)::text || ':' || greatest(v_me, p_friend)::text;
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is null then
    insert into public.conversations (kind, direct_key, created_by)
    values ('direct', v_key, v_me)
    on conflict (direct_key) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from public.conversations where direct_key = v_key; end if;
  end if;

  insert into public.conversation_members (conversation_id, player_id)
  values (v_id, v_me), (v_id, p_friend)
  on conflict do nothing;
  return v_id;
end $$;

create or replace function public.create_group(p_user_id uuid, p_title text, p_members uuid[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_id uuid; v_title text; v_m uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('group:u:' || p_user_id, 10, 3600) then raise exception 'slow down'; end if;
  v_title := trim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  if length(v_title) < 2 or length(v_title) > 40 then raise exception 'bad title'; end if;
  if coalesce(array_length(p_members, 1), 0) < 1 or array_length(p_members, 1) > 29 then
    raise exception 'pick 1 to 29 friends';
  end if;

  insert into public.conversations (kind, title, created_by) values ('group', v_title, v_me)
  returning id into v_id;
  insert into public.conversation_members (conversation_id, player_id, role) values (v_id, v_me, 'owner');

  foreach v_m in array p_members loop
    if v_m <> v_me and public.are_friends(v_me, v_m) and not public.blocked_between(v_me, v_m) then
      insert into public.conversation_members (conversation_id, player_id)
      values (v_id, v_m) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end $$;

create or replace function public.add_to_group(p_user_id uuid, p_conversation uuid, p_friend uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not exists (select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
                 where m.conversation_id = p_conversation and m.player_id = v_me and c.kind = 'group') then
    raise exception 'not a member';
  end if;
  if not public.are_friends(v_me, p_friend) or public.blocked_between(v_me, p_friend) then
    raise exception 'not friends';
  end if;
  if (select count(*) from public.conversation_members where conversation_id = p_conversation) >= 30 then
    raise exception 'group full';
  end if;
  insert into public.conversation_members (conversation_id, player_id)
  values (p_conversation, p_friend) on conflict do nothing;
end $$;

create or replace function public.leave_conversation(p_user_id uuid, p_conversation uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_role text;
begin
  v_me := public.active_player_id(p_user_id);
  select m.role into v_role from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  where m.conversation_id = p_conversation and m.player_id = v_me and c.kind = 'group';
  if v_role is null then raise exception 'not a member'; end if;

  delete from public.conversation_members where conversation_id = p_conversation and player_id = v_me;
  if v_role = 'owner' then
    update public.conversation_members set role = 'owner'
    where conversation_id = p_conversation
      and player_id = (select player_id from public.conversation_members
                       where conversation_id = p_conversation order by joined_at limit 1);
  end if;
end $$;

create or replace function public.set_conversation_muted(p_user_id uuid, p_conversation uuid, p_muted boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid;
begin
  v_me := public.active_player_id(p_user_id);
  update public.conversation_members set muted = p_muted
  where conversation_id = p_conversation and player_id = v_me;
end $$;

-- Is this player allowed in this chat? (Campus chat: anyone at that university.)
create or replace function public.chat_access(p_player uuid, p_conversation uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_conv public.conversations%rowtype; v_uni uuid; v_other uuid;
begin
  select * into v_conv from public.conversations where id = p_conversation;
  if not found then return null; end if;
  if v_conv.kind = 'campus' then
    select university_id into v_uni from public.enrollments
    where player_id = p_player and status in ('active', 'graduated') order by enrolled_at desc limit 1;
    if v_uni is distinct from v_conv.university_id then return null; end if;
    insert into public.conversation_members (conversation_id, player_id)
    values (p_conversation, p_player) on conflict do nothing;
    return 'campus';
  end if;
  if not exists (select 1 from public.conversation_members
                 where conversation_id = p_conversation and player_id = p_player) then
    return null;
  end if;
  if v_conv.kind = 'direct' then
    select player_id into v_other from public.conversation_members
    where conversation_id = p_conversation and player_id <> p_player limit 1;
    if v_other is null or not public.are_friends(p_player, v_other) or public.blocked_between(p_player, v_other) then
      return 'closed';
    end if;
  end if;
  return v_conv.kind;
end $$;

-- =====================================================
-- Sending and reading messages
-- =====================================================
create or replace function public.send_message(p_user_id uuid, p_conversation uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_access text; v_body text; v_id bigint;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('msg:u:' || p_user_id, 20, 30) then raise exception 'slow down'; end if;

  v_access := public.chat_access(v_me, p_conversation);
  if v_access is null then raise exception 'not a member'; end if;
  if v_access = 'closed' then raise exception 'not friends'; end if;
  if v_access = 'campus' and not public.rate_limit_hit('campus:u:' || p_user_id, 5, 30) then
    raise exception 'slow down';
  end if;

  v_body := trim(regexp_replace(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'), '[ \t]+', ' ', 'g'));
  if length(v_body) < 1 or length(v_body) > 500 then raise exception 'bad message'; end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation, v_me, v_body) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation;
  update public.conversation_members set last_read_id = v_id
  where conversation_id = p_conversation and player_id = v_me;

  -- Campus chat is kept for 7 days.
  if random() < 0.002 then
    delete from public.messages m using public.conversations c
    where c.id = m.conversation_id and c.kind = 'campus' and m.created_at < now() - interval '7 days';
  end if;

  return jsonb_build_object('id', v_id, 'at', now());
end $$;

create or replace function public.get_messages(p_user_id uuid, p_conversation uuid, p_after bigint, p_before bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_access text; v_conv public.conversations%rowtype; v_max bigint; v_result jsonb;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('read:u:' || p_user_id, 90, 60) then raise exception 'slow down'; end if;
  v_access := public.chat_access(v_me, p_conversation);
  if v_access is null then raise exception 'not a member'; end if;
  select * into v_conv from public.conversations where id = p_conversation;

  with picked as (
    select m.id, m.sender_id, m.body, m.created_at
    from public.messages m
    where m.conversation_id = p_conversation
      and (p_after is null or m.id > p_after)
      and (p_before is null or m.id < p_before)
      and not exists (select 1 from public.player_mutes pm where pm.muter_id = v_me and pm.muted_id = m.sender_id)
      and not public.blocked_between(v_me, m.sender_id)
    order by m.id desc
    limit case when p_after is null then 40 else 100 end
  )
  select max(p.id), coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'sender_id', p.sender_id, 'sender', pl.display_name,
           'body', p.body, 'at', p.created_at, 'mine', p.sender_id = v_me) order by p.id), '[]'::jsonb)
  into v_max, v_result
  from picked p join public.players pl on pl.id = p.sender_id;

  if v_max is not null then
    update public.conversation_members set last_read_id = greatest(last_read_id, v_max)
    where conversation_id = p_conversation and player_id = v_me;
  end if;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conv.id, 'kind', v_conv.kind, 'closed', v_access = 'closed',
      'title', case
        when v_conv.kind = 'direct' then (
          select pl.display_name from public.conversation_members cm join public.players pl on pl.id = cm.player_id
          where cm.conversation_id = v_conv.id and cm.player_id <> v_me limit 1)
        else v_conv.title end,
      'members', case when v_conv.kind = 'group' then (
          select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name, 'role', cm.role) order by pl.display_name)
          from public.conversation_members cm join public.players pl on pl.id = cm.player_id
          where cm.conversation_id = v_conv.id) end),
    'messages', v_result);
end $$;

-- =====================================================
-- Dating
-- =====================================================
create or replace function public.set_dating(p_user_id uuid, p_on boolean, p_confirm_adult boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_age int;
begin
  v_me := public.active_player_id(p_user_id);
  if p_on then
    select age into v_age from public.players where id = v_me;
    if v_age < 18 then raise exception 'character too young'; end if;
    if not coalesce(p_confirm_adult, false) then raise exception 'confirm adult'; end if;
    update public.players set dating_opt_in = true, adult_confirmed_at = coalesce(adult_confirmed_at, now())
    where id = v_me;
  else
    if public.current_partner(v_me) is not null then raise exception 'break up first'; end if;
    update public.players set dating_opt_in = false where id = v_me;
    update public.romances set status = 'declined', ended_at = now(), ended_by = v_me
    where status = 'asked' and (player_a = v_me or player_b = v_me);
  end if;
end $$;

create or replace function public.ask_out(p_user_id uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_bond int; v_name text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('ask:u:' || p_user_id, 10, 86400) then raise exception 'slow down'; end if;
  if p_target = v_me then raise exception 'not yourself'; end if;

  if not exists (select 1 from public.players where id = v_me and dating_opt_in and age >= 18) then
    raise exception 'dating off';
  end if;
  if not exists (select 1 from public.players pl join public.profiles pr on pr.id = pl.user_id
                 where pl.id = p_target and pl.dating_opt_in and pl.age >= 18 and pr.status = 'active') then
    raise exception 'they are not dating';
  end if;
  if not public.are_friends(v_me, p_target) or public.blocked_between(v_me, p_target) then
    raise exception 'not friends';
  end if;

  select bond into v_bond from public.relationships
  where player_a = least(v_me, p_target) and player_b = greatest(v_me, p_target);
  if coalesce(v_bond, 0) < 25 then raise exception 'not close enough'; end if;

  if public.current_partner(v_me) is not null then raise exception 'already dating'; end if;
  if public.current_partner(p_target) is not null then raise exception 'they are taken'; end if;
  if exists (select 1 from public.romances
             where player_a = least(v_me, p_target) and player_b = greatest(v_me, p_target)
               and status in ('ended', 'declined') and ended_at > now() - interval '3 days') then
    raise exception 'too soon';
  end if;

  insert into public.romances (player_a, player_b, status, asked_by)
  values (least(v_me, p_target), greatest(v_me, p_target), 'asked', v_me);

  select display_name into v_name from public.players where id = v_me;
  insert into public.notifications (player_id, kind, title)
  values (p_target, 'asked_out', v_name || ' asked you out 💘');
exception when unique_violation then
  raise exception 'already asked';
end $$;

create or replace function public.respond_ask(p_user_id uuid, p_from uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_id uuid; v_name text;
begin
  v_me := public.active_player_id(p_user_id);
  select id into v_id from public.romances
  where player_a = least(v_me, p_from) and player_b = greatest(v_me, p_from)
    and status = 'asked' and asked_by = p_from
  for update;
  if v_id is null then raise exception 'no request'; end if;
  select display_name into v_name from public.players where id = v_me;

  if p_accept then
    if public.current_partner(v_me) is not null then raise exception 'already dating'; end if;
    if public.current_partner(p_from) is not null then raise exception 'they are taken'; end if;
    update public.romances set status = 'dating', started_at = now() where id = v_id;
    perform public.bump_bond(v_me, p_from, 10);
    update public.player_state set happiness = least(100, happiness + 10) where player_id in (v_me, p_from);
    insert into public.notifications (player_id, kind, title)
    values (p_from, 'dating', v_name || ' said yes! You are now dating 💞');
  else
    update public.romances set status = 'declined', ended_at = now(), ended_by = v_me where id = v_id;
    insert into public.notifications (player_id, kind, title)
    values (p_from, 'declined', v_name || ' said no this time');
  end if;
end $$;

create or replace function public.break_up(p_user_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_partner uuid; v_name text;
begin
  v_me := public.active_player_id(p_user_id);
  v_partner := public.current_partner(v_me);
  if v_partner is null then raise exception 'not dating'; end if;

  update public.romances set
    status = 'ended', ended_at = now(), ended_by = v_me,
    end_reason = nullif(left(trim(coalesce(p_reason, '')), 120), '')
  where status = 'dating' and player_a = least(v_me, v_partner) and player_b = greatest(v_me, v_partner);

  perform public.bump_bond(v_me, v_partner, -15);
  update public.player_state set happiness = greatest(0, happiness - 10) where player_id in (v_me, v_partner);

  select display_name into v_name from public.players where id = v_me;
  insert into public.notifications (player_id, kind, title)
  values (v_partner, 'breakup', '💔 ' || v_name || ' broke up with you');
end $$;

-- =====================================================
-- Gifts
-- =====================================================
create or replace function public.send_gift(p_user_id uuid, p_target uuid, p_gift text, p_note text, p_key text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_gift public.gift_types%rowtype; v_name text; v_tname text; v_note text;
begin
  v_me := public.active_player_id(p_user_id);
  if exists (select 1 from public.gifts where from_id = v_me and idempotency_key = p_key) then
    return public.game_dynamic(v_me) || jsonb_build_object('duplicate', true);
  end if;
  if not public.rate_limit_hit('gift:u:' || p_user_id, 20, 3600) then raise exception 'slow down'; end if;
  if p_target = v_me then raise exception 'not yourself'; end if;
  if not public.are_friends(v_me, p_target) or public.blocked_between(v_me, p_target) then
    raise exception 'not friends';
  end if;

  select * into v_gift from public.gift_types where slug = p_gift;
  if not found then raise exception 'unknown gift'; end if;
  select display_name into v_name from public.players where id = v_me;
  select display_name into v_tname from public.players where id = p_target;
  v_note := nullif(left(trim(coalesce(p_note, '')), 80), '');

  perform public.wallet_apply(v_me, -v_gift.cost_kobo, 'gift', 'Gift: ' || v_gift.name || ' for ' || v_tname);
  insert into public.gifts (from_id, to_id, gift_slug, cost_kobo, note, idempotency_key)
  values (v_me, p_target, v_gift.slug, v_gift.cost_kobo, v_note, p_key);
  perform public.bump_bond(v_me, p_target, v_gift.bond_delta);
  update public.player_state set happiness = least(100, happiness + v_gift.happiness_delta)
  where player_id = p_target;

  insert into public.notifications (player_id, kind, title, body)
  values (p_target, 'gift', v_name || ' sent you ' || v_gift.emoji || ' ' || v_gift.name, v_note);

  return public.game_dynamic(v_me) || jsonb_build_object('duplicate', false);
end $$;

-- =====================================================
-- Everything for the Social screen in one call, and the small badge counts
-- =====================================================
create or replace function public.get_social(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_uni uuid; v_campus uuid; v_partner uuid; v_meta record;
begin
  v_me := public.active_player_id(p_user_id);
  select university_id into v_uni from public.enrollments
  where player_id = v_me and status in ('active', 'graduated') order by enrolled_at desc limit 1;
  if v_uni is not null then
    v_campus := public.campus_conversation(v_uni);
    perform public.chat_access(v_me, v_campus);
  end if;
  v_partner := public.current_partner(v_me);
  select age, dating_opt_in into v_meta from public.players where id = v_me;

  return jsonb_build_object(
    'me', jsonb_build_object('id', v_me, 'age', v_meta.age, 'dating_opt_in', v_meta.dating_opt_in),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.id, 'name', pl.display_name,
        'skin', pl.avatar_skin, 'hair_style', pl.avatar_hair_style,
        'hair_color', pl.avatar_hair_color, 'outfit', pl.avatar_outfit,
        'online', s.last_seen_at > now() - interval '90 seconds',
        'last_seen', s.last_seen_at,
        'place', l.name,
        'bond', coalesce(r.bond, 0),
        'dating_opt_in', pl.dating_opt_in and pl.age >= 18,
        'partner', pl.id = v_partner)
        order by (s.last_seen_at > now() - interval '90 seconds') desc, pl.display_name)
      from public.friendships f
      join public.players pl on pl.id = case when f.player_a = v_me then f.player_b else f.player_a end
      join public.profiles pr on pr.id = pl.user_id and pr.status = 'active'
      left join public.player_state s on s.player_id = pl.id
      left join public.locations l on l.id = s.location_id
      left join public.relationships r on r.player_a = least(v_me, pl.id) and r.player_b = greatest(v_me, pl.id)
      where (f.player_a = v_me or f.player_b = v_me) and f.status = 'accepted'
        and not public.blocked_between(v_me, pl.id)), '[]'::jsonb),
    'requests_in', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name, 'at', f.created_at) order by f.created_at desc)
      from public.friendships f join public.players pl on pl.id = f.requested_by
      where (f.player_a = v_me or f.player_b = v_me) and f.status = 'pending' and f.requested_by <> v_me
        and not public.blocked_between(v_me, pl.id)), '[]'::jsonb),
    'requests_out', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name) order by f.created_at desc)
      from public.friendships f
      join public.players pl on pl.id = case when f.player_a = v_me then f.player_b else f.player_a end
      where (f.player_a = v_me or f.player_b = v_me) and f.status = 'pending' and f.requested_by = v_me), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(x.c order by x.campus desc, x.last desc)
      from (
        select c.kind = 'campus' as campus, c.last_message_at as last,
          jsonb_build_object(
            'id', c.id, 'kind', c.kind, 'muted', cm.muted,
            'title', case
              when c.kind = 'direct' then (
                select pl.display_name from public.conversation_members o join public.players pl on pl.id = o.player_id
                where o.conversation_id = c.id and o.player_id <> v_me limit 1)
              else c.title end,
            'last', (select jsonb_build_object('body', left(m.body, 80), 'sender', pl.display_name, 'at', m.created_at)
                     from public.messages m join public.players pl on pl.id = m.sender_id
                     where m.conversation_id = c.id
                       and not exists (select 1 from public.player_mutes pm where pm.muter_id = v_me and pm.muted_id = m.sender_id)
                       and not public.blocked_between(v_me, m.sender_id)
                     order by m.id desc limit 1),
            'unread', (select count(*) from (select 1 from public.messages m
                       where m.conversation_id = c.id and m.id > cm.last_read_id and m.sender_id <> v_me
                         and not exists (select 1 from public.player_mutes pm where pm.muter_id = v_me and pm.muted_id = m.sender_id)
                         and not public.blocked_between(v_me, m.sender_id)
                       limit 99) u)) as c
        from public.conversation_members cm
        join public.conversations c on c.id = cm.conversation_id
        where cm.player_id = v_me
        order by c.last_message_at desc
        limit 50
      ) x), '[]'::jsonb),
    'partner', case when v_partner is null then null else (
      select jsonb_build_object('id', pl.id, 'name', pl.display_name, 'since', ro.started_at)
      from public.players pl join public.romances ro
        on ro.status = 'dating' and ro.player_a = least(v_me, pl.id) and ro.player_b = greatest(v_me, pl.id)
      where pl.id = v_partner) end,
    'asks_in', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name, 'at', ro.created_at))
      from public.romances ro join public.players pl on pl.id = ro.asked_by
      where ro.status = 'asked' and ro.asked_by <> v_me and (ro.player_a = v_me or ro.player_b = v_me)), '[]'::jsonb),
    'asks_out', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name))
      from public.romances ro
      join public.players pl on pl.id = case when ro.player_a = v_me then ro.player_b else ro.player_a end
      where ro.status = 'asked' and ro.asked_by = v_me), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('name', pl.display_name, 'started_at', ro.started_at,
                                          'ended_at', ro.ended_at) order by ro.ended_at desc)
      from public.romances ro
      join public.players pl on pl.id = case when ro.player_a = v_me then ro.player_b else ro.player_a end
      where ro.status = 'ended' and ro.started_at is not null and (ro.player_a = v_me or ro.player_b = v_me)), '[]'::jsonb),
    'gift_types', (select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'emoji', emoji,
                     'cost_kobo', cost_kobo, 'romantic', romantic) order by sort_order) from public.gift_types),
    'muted', coalesce((
      select jsonb_agg(jsonb_build_object('id', pl.id, 'name', pl.display_name))
      from public.player_mutes pm join public.players pl on pl.id = pm.muted_id where pm.muter_id = v_me), '[]'::jsonb)
  );
end $$;

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
      from public.friendships where (player_a = v_me or player_b = v_me) and status = 'pending'), '[]'::jsonb)
  );
end $$;

-- Reporting a chat message (a copy is kept as evidence).
create or replace function public.report_message(p_user_id uuid, p_message bigint, p_reason text, p_details text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_msg public.messages%rowtype; v_kind text; v_id bigint;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('report:u:' || p_user_id, 10, 3600) then raise exception 'slow down'; end if;
  select * into v_msg from public.messages where id = p_message;
  if not found or v_msg.sender_id = v_me then raise exception 'unknown message'; end if;
  if public.chat_access(v_me, v_msg.conversation_id) is null then raise exception 'unknown message'; end if;
  select kind into v_kind from public.conversations where id = v_msg.conversation_id;

  insert into public.player_reports (reporter_id, reported_id, reason, details, context)
  values (v_me, v_msg.sender_id, p_reason, nullif(left(trim(coalesce(p_details, '')), 300), ''),
          jsonb_build_object('message_id', v_msg.id, 'body', v_msg.body, 'at', v_msg.created_at,
                             'place', case v_kind when 'campus' then 'Campus chat'
                                                  when 'group' then 'Group chat' else 'Private chat' end))
  returning id into v_id;
  return v_id;
end $$;

-- =====================================================
-- Who may call what: only our trusted server
-- =====================================================
do $$
declare f text;
begin
  foreach f in array array[
    'are_friends(uuid, uuid)', 'blocked_between(uuid, uuid)', 'bump_bond(uuid, uuid, int)',
    'current_partner(uuid)', 'campus_conversation(uuid)', 'chat_access(uuid, uuid)'
  ] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;

  foreach f in array array[
    'friend_request(uuid, uuid)', 'respond_friend(uuid, uuid, boolean)', 'remove_friend(uuid, uuid)',
    'mute_player(uuid, uuid, boolean)', 'open_direct(uuid, uuid)', 'create_group(uuid, text, uuid[])',
    'add_to_group(uuid, uuid, uuid)', 'leave_conversation(uuid, uuid)',
    'set_conversation_muted(uuid, uuid, boolean)', 'send_message(uuid, uuid, text)',
    'get_messages(uuid, uuid, bigint, bigint)', 'set_dating(uuid, boolean, boolean)',
    'ask_out(uuid, uuid)', 'respond_ask(uuid, uuid, boolean)', 'break_up(uuid, text)',
    'send_gift(uuid, uuid, text, text, text)', 'get_social(uuid)', 'social_badges(uuid)',
    'report_message(uuid, bigint, text, text)'
  ] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
end $$;
