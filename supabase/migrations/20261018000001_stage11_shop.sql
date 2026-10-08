-- CAMPUS LIFE: Stage 11A - the shop (real money for items only) and cars
-- Real money (paid through Paystack) only ever buys items. It never adds game naira.
-- Purchases are for players aged 18 and over. An item is handed over only after the
-- server has confirmed the payment with Paystack. Safe to run more than once.

insert into public.app_config (key, value) values ('shop_open', 'true')
on conflict (key) do nothing;

-- What a player is wearing and driving, readable by anyone who can see them.
alter table public.players add column if not exists style jsonb not null default '{}'::jsonb;

-- ---------- The catalogue ----------

create table if not exists public.shop_items (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  category text not null check (category in ('car','ride','outfit','look','room','move','social','status')),
  -- Where it is worn or used. Only one item per slot is equipped; room items have none.
  slot text check (slot in ('car','outfit','cap','glasses','chain','shoes','tag')),
  name text not null check (length(name) between 2 and 60),
  description text not null check (length(description) <= 200),
  -- Real naira, in kobo (what Paystack charges).
  price_kobo bigint not null check (price_kobo between 10000 and 10000000),
  seats smallint not null default 0 check (seats between 0 and 8),
  look jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order smallint not null default 0
);
alter table public.shop_items enable row level security;
revoke all on public.shop_items from anon, authenticated;

insert into public.shop_items (slug, category, slot, name, description, price_kobo, seats, look, is_active, sort_order) values
  ('car_corolla', 'car', 'car', 'Toyota Corolla', 'Reliable and clean. Seats you and 3 friends.', 100000, 4, '{"color":"#e5e7eb","model":"sedan"}', true, 1),
  ('car_accord', 'car', 'car', 'Honda Accord', 'Smooth ride, silver finish. Seats 4.', 150000, 4, '{"color":"#9ca3af","model":"sedan"}', true, 2),
  ('car_lexus', 'car', 'car', 'Lexus', 'Black, quiet and classy. Seats 4.', 200000, 4, '{"color":"#111827","model":"sedan"}', true, 3),
  ('car_bmw', 'car', 'car', 'BMW', 'The campus head-turner in deep blue. Seats 4.', 250000, 4, '{"color":"#1d4ed8","model":"sedan"}', true, 4),
  ('car_gwagon', 'car', 'car', 'Mercedes G-Wagon', 'The big boss of the car park. Seats 4.', 500000, 4, '{"color":"#0a0a0a","model":"suv"}', true, 5),
  ('outfit_agbada', 'outfit', 'outfit', 'Agbada', 'Flowing native wear for big occasions.', 80000, 0, '{"shirt":"#f5f5f4","trousers":"#f5f5f4","robe":"#1d4ed8"}', true, 10),
  ('outfit_ankara', 'outfit', 'outfit', 'Ankara shirt', 'Bright ankara print shirt.', 40000, 0, '{"shirt":"#ea580c","trousers":"#1f2937"}', true, 11),
  ('outfit_jersey', 'outfit', 'outfit', 'Super Eagles jersey', 'Green and white, match-day ready.', 50000, 0, '{"shirt":"#16a34a","trousers":"#f8fafc"}', true, 12),
  ('outfit_suit', 'outfit', 'outfit', 'Black suit', 'Sharp for dinner nights and defences.', 100000, 0, '{"shirt":"#111827","trousers":"#111827"}', true, 13),
  ('outfit_hoodie', 'outfit', 'outfit', 'Purple hoodie', 'Cosy for cold lecture halls.', 30000, 0, '{"shirt":"#7c3aed","trousers":"#1f2937"}', true, 14),
  ('look_shades', 'look', 'glasses', 'Dark shades', 'Cool in the sun, cooler at night.', 20000, 0, '{"glasses":"#0a0a0a"}', true, 20),
  ('look_chain', 'look', 'chain', 'Gold chain', 'A shiny gold chain.', 40000, 0, '{"chain":"#facc15"}', true, 21),
  ('look_cap', 'look', 'cap', 'Red snapback', 'A red snapback cap.', 20000, 0, '{"cap":"#dc2626"}', true, 22),
  ('look_sneakers', 'look', 'shoes', 'Designer sneakers', 'Red sneakers everybody notices.', 30000, 0, '{"shoes":"#ef4444"}', true, 23),
  ('room_ac', 'room', null, 'Air conditioner', 'Cool air in your hostel room.', 150000, 0, '{"item":"ac"}', true, 30),
  ('room_speaker', 'room', null, 'Bluetooth speaker', 'A big speaker for room gist.', 50000, 0, '{"item":"speaker"}', true, 31),
  ('room_posters', 'room', null, 'Posters', 'Music and football posters on your wall.', 20000, 0, '{"item":"posters"}', true, 32),
  ('room_led', 'room', null, 'LED lights', 'Colour-changing lights round the ceiling.', 40000, 0, '{"item":"led"}', true, 33),
  ('room_fridge', 'room', null, 'Mini fridge', 'Cold drinks any time.', 80000, 0, '{"item":"fridge"}', true, 34),
  ('room_ps5', 'room', null, 'Game corner', 'A TV and console in your room.', 150000, 0, '{"item":"ps5"}', true, 35),
  ('tag_gold', 'status', 'tag', 'Gold name tag', 'Your name tag shines gold.', 50000, 0, '{"tag":"#facc15"}', true, 40),
  ('tag_diamond', 'status', 'tag', 'Diamond name tag', 'An ice-blue diamond name tag.', 100000, 0, '{"tag":"#67e8f9"}', true, 41),
  -- Coming in the next stage.
  ('ride_bicycle', 'ride', null, 'Bicycle', 'Faster than walking. Coming soon.', 30000, 1, '{}', false, 50),
  ('ride_scooter', 'ride', null, 'Scooter', 'Zip round campus. Coming soon.', 60000, 1, '{}', false, 51),
  ('ride_okada', 'ride', null, 'Okada bike', 'Carry one friend on the back. Coming soon.', 80000, 2, '{}', false, 52),
  ('move_shaku', 'move', null, 'Shaku shaku', 'Dance move. Coming soon.', 10000, 0, '{}', false, 60),
  ('move_zanku', 'move', null, 'Zanku', 'Dance move. Coming soon.', 15000, 0, '{}', false, 61),
  ('move_legwork', 'move', null, 'Legwork', 'Dance move. Coming soon.', 15000, 0, '{}', false, 62),
  ('social_vip', 'social', null, 'Club VIP booth', 'A VIP booth for you and friends for a night. Coming soon.', 150000, 0, '{}', false, 70),
  ('social_birthday', 'social', null, 'Birthday party pack', 'Banner, cake and music at the club. Coming soon.', 200000, 0, '{}', false, 71),
  ('status_plate', 'status', null, 'Custom number plate', 'Your own plate on your car. Coming soon.', 80000, 0, '{}', false, 72)
on conflict (slug) do nothing;

create table if not exists public.player_items (
  player_id uuid not null references public.players (id) on delete cascade,
  item_slug text not null references public.shop_items (slug),
  purchase_id uuid,
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_slug)
);
alter table public.player_items enable row level security;
revoke all on public.player_items from anon, authenticated;

-- Every real-money order. Kept for good, for receipts and disputes.
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^CL-[a-f0-9]{32}$'),
  player_id uuid not null references public.players (id) on delete restrict,
  item_slug text not null references public.shop_items (slug),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  provider text not null default 'paystack',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  provider_txn text,
  failure text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
create index if not exists purchases_player_idx on public.purchases (player_id, created_at desc);
create index if not exists purchases_status_idx on public.purchases (status, created_at desc);

-- ---------- Buying ----------

-- Opens an order. The server then sends the player to Paystack with this reference.
create or replace function public.create_purchase(p_user_id uuid, p_item text, p_confirm_adult boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_item public.shop_items%rowtype; v_p public.players%rowtype; v_ref text; v_id uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.config_bool('shop_open', true) then raise exception 'shop: closed'; end if;
  if not public.rate_limit_hit('buy:u:' || p_user_id, 10, 3600) then raise exception 'slow down'; end if;

  select * into v_item from public.shop_items where slug = p_item and is_active;
  if not found then raise exception 'shop: unknown item'; end if;

  select * into v_p from public.players where id = v_me for update;
  if v_p.age < 18 then raise exception 'shop: adults only'; end if;
  if v_p.adult_confirmed_at is null then
    if not coalesce(p_confirm_adult, false) then raise exception 'shop: confirm age'; end if;
    update public.players set adult_confirmed_at = now() where id = v_me;
  end if;

  if exists (select 1 from public.player_items where player_id = v_me and item_slug = v_item.slug) then
    raise exception 'shop: owned';
  end if;

  v_ref := 'CL-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.purchases (reference, player_id, item_slug, amount_kobo)
  values (v_ref, v_me, v_item.slug, v_item.price_kobo)
  returning id into v_id;

  return jsonb_build_object('purchase_id', v_id, 'reference', v_ref,
                            'amount_kobo', v_item.price_kobo, 'name', v_item.name);
end $$;

-- Hands over the item once Paystack has confirmed the payment. Safe to call many
-- times for the same order (the redirect and the webhook both call it).
create or replace function public.fulfil_purchase(
  p_reference text, p_amount_kobo bigint, p_currency text, p_provider_txn text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_pu public.purchases%rowtype; v_item public.shop_items%rowtype;
begin
  select * into v_pu from public.purchases where reference = p_reference for update;
  if not found then raise exception 'unknown purchase'; end if;
  if v_pu.status = 'paid' then
    return jsonb_build_object('status', 'paid', 'item', v_pu.item_slug, 'player_id', v_pu.player_id, 'already', true);
  end if;
  if v_pu.status <> 'pending' then
    return jsonb_build_object('status', v_pu.status, 'item', v_pu.item_slug, 'player_id', v_pu.player_id);
  end if;
  if p_amount_kobo is distinct from v_pu.amount_kobo or p_currency is distinct from v_pu.currency then
    update public.purchases set status = 'failed', failure = 'amount or currency did not match',
      provider_txn = p_provider_txn
    where id = v_pu.id;
    return jsonb_build_object('status', 'failed', 'item', v_pu.item_slug, 'player_id', v_pu.player_id);
  end if;

  update public.purchases set status = 'paid', paid_at = now(), provider_txn = p_provider_txn where id = v_pu.id;
  insert into public.player_items (player_id, item_slug, purchase_id)
  values (v_pu.player_id, v_pu.item_slug, v_pu.id)
  on conflict (player_id, item_slug) do nothing;

  -- Wear or drive it straight away if nothing else is in that slot.
  select * into v_item from public.shop_items where slug = v_pu.item_slug;
  if v_item.slot is not null then
    update public.players set style = style || jsonb_build_object(v_item.slot, v_item.slug)
    where id = v_pu.player_id and not (style ? v_item.slot);
  end if;

  insert into public.notifications (player_id, kind, title, body)
  values (v_pu.player_id, 'purchase', '🛍️ ' || v_item.name || ' is yours!',
          'Payment received: ₦' || to_char(v_pu.amount_kobo / 100, 'FM999,999,990') || '. Thank you!');

  return jsonb_build_object('status', 'paid', 'item', v_pu.item_slug, 'player_id', v_pu.player_id, 'already', false);
end $$;

-- Marks an order as failed (Paystack said the payment did not go through).
create or replace function public.fail_purchase(p_reference text, p_reason text)
returns void
language sql security definer set search_path = ''
as $$
  update public.purchases set status = 'failed', failure = left(p_reason, 200)
  where reference = p_reference and status = 'pending'
$$;

-- The shop as one player sees it.
create or replace function public.get_shop(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_p public.players%rowtype;
begin
  v_me := public.active_player_id(p_user_id);
  select * into v_p from public.players where id = v_me;
  return jsonb_build_object(
    'open', public.config_bool('shop_open', true),
    'adult', v_p.age >= 18,
    'age_confirmed', v_p.adult_confirmed_at is not null,
    'style', v_p.style,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', i.slug, 'category', i.category, 'slot', i.slot, 'name', i.name,
        'description', i.description, 'price_kobo', i.price_kobo, 'seats', i.seats,
        'look', i.look, 'available', i.is_active,
        'owned', exists (select 1 from public.player_items pi where pi.player_id = v_me and pi.item_slug = i.slug))
        order by i.sort_order)
      from public.shop_items i), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', p.reference, 'item', s.name, 'amount_kobo', p.amount_kobo,
        'status', p.status, 'created_at', p.created_at) order by p.created_at desc)
      from (select * from public.purchases where player_id = v_me order by created_at desc limit 10) p
      join public.shop_items s on s.slug = p.item_slug), '[]'::jsonb)
  );
end $$;

-- Wear or take off an item (or choose which car you drive).
create or replace function public.equip_item(p_user_id uuid, p_item text, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_item public.shop_items%rowtype; v_style jsonb;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('equip:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  select * into v_item from public.shop_items where slug = p_item;
  if not found or v_item.slot is null then raise exception 'shop: unknown item'; end if;
  if not exists (select 1 from public.player_items where player_id = v_me and item_slug = v_item.slug) then
    raise exception 'shop: not owned';
  end if;
  update public.players set style = case when p_on then style || jsonb_build_object(v_item.slot, v_item.slug)
                                         when style ->> v_item.slot = v_item.slug then style - v_item.slot
                                         else style end
  where id = v_me
  returning style into v_style;
  return jsonb_build_object('style', v_style);
end $$;

-- ---------- Cars: drive somewhere and give friends a lift ----------

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.players (id) on delete cascade,
  car_slug text not null references public.shop_items (slug),
  location_id uuid not null references public.locations (id) on delete cascade,
  shard integer not null default 1,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.rides enable row level security;
revoke all on public.rides from anon, authenticated;

create table if not exists public.ride_members (
  ride_id uuid not null references public.rides (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  responded_at timestamptz,
  primary key (ride_id, player_id)
);
alter table public.ride_members enable row level security;
revoke all on public.ride_members from anon, authenticated;
create index if not exists ride_members_player_idx on public.ride_members (player_id, status);

-- Leaving a private university hostel after curfew costs a gate fine, by car too.
create or replace function public.curfew_check(p_player uuid, p_from uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_type public.university_type; v_kind text; v_hour int; v_fine bigint;
begin
  select u.type, l.kind into v_type, v_kind
  from public.locations l join public.universities u on u.id = l.university_id where l.id = p_from;
  v_hour := extract(hour from (now() at time zone 'Africa/Lagos'))::int;
  if v_type = 'private' and v_kind = 'hostel' and (v_hour >= 23 or v_hour < 5) then
    v_fine := public.config_number('curfew_fine_kobo', 200000)::bigint;
    if not exists (select 1 from public.wallets where player_id = p_player and balance_kobo >= v_fine) then
      raise exception 'curfew';
    end if;
    perform public.wallet_apply(p_player, -v_fine, 'curfew_fine', 'Gate fine: left the hostel after curfew');
    return true;
  end if;
  return false;
end $$;

-- Drive to a place (1 energy, however far) and offer friends a lift.
create or replace function public.drive_to(p_user_id uuid, p_location uuid, p_friends uuid[])
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_s public.player_state%rowtype; v_car public.shop_items%rowtype; v_to public.locations%rowtype;
  v_uni uuid; v_n int; v_friend uuid; v_id uuid; v_name text; v_fined boolean;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('travel:u:' || p_user_id, 60, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select i.* into v_car from public.players p
  join public.shop_items i on i.slug = p.style ->> 'car'
  join public.player_items pi on pi.player_id = p.id and pi.item_slug = i.slug
  where p.id = v_me;
  if not found then raise exception 'ride: no car'; end if;

  select count(distinct f) into v_n from unnest(coalesce(p_friends, '{}'::uuid[])) f where f is not null and f <> v_me;
  if v_n > v_car.seats - 1 then raise exception 'ride: too many'; end if;
  foreach v_friend in array coalesce(p_friends, '{}'::uuid[]) loop
    if v_friend is null or v_friend = v_me then continue; end if;
    if not public.are_friends(v_me, v_friend) or public.blocked_between(v_me, v_friend) then
      raise exception 'not friends';
    end if;
  end loop;

  select university_id into v_uni from public.enrollments where player_id = v_me and status = 'active';
  select * into v_to from public.locations where id = p_location and university_id = v_uni;
  if not found then raise exception 'unknown location'; end if;

  select * into v_s from public.player_state where player_id = v_me for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  if v_s.energy < 1 then raise exception 'too tired'; end if;

  v_fined := false;
  if v_to.id <> v_s.location_id then
    v_fined := public.curfew_check(v_me, v_s.location_id);
    update public.player_state set
      location_id = v_to.id, energy = energy - 1,
      shard = public.room_for(v_me, v_to.id), updated_at = now()
    where player_id = v_me;
  end if;

  if v_n > 0 then
    insert into public.rides (driver_id, car_slug, location_id, shard, expires_at)
    select v_me, v_car.slug, v_to.id, s.shard, now() + interval '10 minutes'
    from public.player_state s where s.player_id = v_me
    returning id into v_id;
    insert into public.ride_members (ride_id, player_id)
    select distinct v_id, f from unnest(p_friends) f where f is not null and f <> v_me;
    select display_name into v_name from public.players where id = v_me;
    insert into public.notifications (player_id, kind, title, body, data)
    select distinct f, 'ride', '🚗 ' || v_name || ' offered you a lift',
           'In a ' || v_car.name || ' to ' || v_to.name || '.', jsonb_build_object('ride_id', v_id)
    from unnest(p_friends) f where f is not null and f <> v_me;
  end if;

  return public.game_dynamic(v_me) || jsonb_build_object('ride_id', v_id, 'curfew_fine', v_fined);
end $$;

-- A friend hops in (they arrive with the driver, no energy used) or says no.
create or replace function public.respond_ride(p_user_id uuid, p_ride uuid, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_r public.rides%rowtype; v_s public.player_state%rowtype; v_kind text; v_name text; v_car text;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('travel:u:' || p_user_id, 60, 60) then raise exception 'slow down'; end if;

  perform 1 from public.ride_members where ride_id = p_ride and player_id = v_me and status = 'invited' for update;
  if not found then raise exception 'ride: no offer'; end if;
  select * into v_r from public.rides where id = p_ride;
  if v_r.expires_at < now() or public.blocked_between(v_me, v_r.driver_id) then raise exception 'ride: expired'; end if;

  if not p_accept then
    update public.ride_members set status = 'declined', responded_at = now() where ride_id = p_ride and player_id = v_me;
    return public.game_dynamic(v_me);
  end if;

  perform public.sync_player_state(v_me);
  select * into v_s from public.player_state where player_id = v_me for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  if v_s.location_id <> v_r.location_id then
    perform public.curfew_check(v_me, v_s.location_id);
  end if;
  update public.player_state set location_id = v_r.location_id, shard = v_r.shard, updated_at = now()
  where player_id = v_me;
  update public.ride_members set status = 'joined', responded_at = now() where ride_id = p_ride and player_id = v_me;
  perform public.bump_bond(v_me, v_r.driver_id, 2);

  select display_name into v_name from public.players where id = v_me;
  select name into v_car from public.shop_items where slug = v_r.car_slug;
  insert into public.notifications (player_id, kind, title)
  values (v_r.driver_id, 'ride', '🚗 ' || v_name || ' hopped into your ' || v_car);

  select kind into v_kind from public.locations where id = v_r.location_id;
  return public.game_dynamic(v_me) || jsonb_build_object('ride_kind', v_kind);
end $$;

-- ---------- Everyone sees what you wear (people around you) ----------

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
               'hair_color', pl.avatar_hair_color, 'outfit', pl.avatar_outfit, 'style', pl.style,
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

-- ---------- The game state: your style, room items and the item looks ----------

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
      'hair_color', v_player.avatar_hair_color, 'outfit', v_player.avatar_outfit,
      'style', v_player.style,
      'room_items', (
        select coalesce(jsonb_agg(i.look ->> 'item'), '[]'::jsonb)
        from public.player_items pi join public.shop_items i on i.slug = pi.item_slug
        where pi.player_id = v_player.id and i.category = 'room')),
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
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', i.slug, 'category', i.category, 'slot', i.slot, 'name', i.name,
        'seats', i.seats, 'look', i.look) order by i.sort_order), '[]'::jsonb)
      from public.shop_items i where i.slot is not null),
    'ads', public.live_ads(v_enr.university_id)
  ) || public.game_dynamic(v_player.id);
end $$;

-- ---------- Lift offers show up with the other badges ----------

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
        and not public.blocked_between(v_me, o.host_id)), '[]'::jsonb),
    'rides', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'driver_id', r.driver_id, 'driver', d.display_name,
               'car', c.name, 'place', l.name, 'place_kind', l.kind,
               'expires_at', r.expires_at) order by r.created_at desc)
      from public.ride_members m
      join public.rides r on r.id = m.ride_id
      join public.players d on d.id = r.driver_id
      join public.shop_items c on c.slug = r.car_slug
      join public.locations l on l.id = r.location_id
      where m.player_id = v_me and m.status = 'invited' and r.expires_at > now()
        and not public.blocked_between(v_me, r.driver_id)), '[]'::jsonb)
  );
end $$;

-- ---------- Who may call what ----------

revoke all on function public.create_purchase(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.fulfil_purchase(text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.fail_purchase(text, text) from public, anon, authenticated;
revoke all on function public.get_shop(uuid) from public, anon, authenticated;
revoke all on function public.equip_item(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.curfew_check(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.drive_to(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.respond_ride(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.create_purchase(uuid, text, boolean) to service_role;
grant execute on function public.fulfil_purchase(text, bigint, text, text) to service_role;
grant execute on function public.fail_purchase(text, text) to service_role;
grant execute on function public.get_shop(uuid) to service_role;
grant execute on function public.equip_item(uuid, text, boolean) to service_role;
grant execute on function public.drive_to(uuid, uuid, uuid[]) to service_role;
grant execute on function public.respond_ride(uuid, uuid, boolean) to service_role;
