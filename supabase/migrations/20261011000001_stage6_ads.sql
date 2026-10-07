-- CAMPUS LIFE: Stage 6A - advertising (billboards, club songs, market products)
-- Ads are data managed from the admin panel. They only show while active and in schedule.
-- Safe to run more than once.

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('billboard', 'club_song', 'market_product')),
  title text not null check (length(title) between 2 and 60),            -- internal name for staff
  advertiser text not null check (length(advertiser) between 2 and 60),
  headline text not null check (length(headline) between 2 and 40),      -- billboard text / song / product
  subline text check (length(subline) <= 60),                             -- tagline / artist / product line
  price_text text check (length(price_text) <= 20),                       -- products only, e.g. "₦1,500"
  bg_color text not null default '#111827' check (bg_color ~ '^#[0-9a-fA-F]{6}$'),
  fg_color text not null default '#ffffff' check (fg_color ~ '^#[0-9a-fA-F]{6}$'),
  destination_url text check (destination_url ~ '^https://[^[:space:]]+$' and length(destination_url) <= 500),
  university_id uuid references public.universities (id) on delete cascade, -- null = every campus
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  weight smallint not null default 1 check (weight between 1 and 100),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists ads_live_idx on public.ads (placement) where status = 'active';
alter table public.ads enable row level security;
revoke all on public.ads from anon, authenticated;

-- Daily totals (small and fast to read) ...
create table if not exists public.ad_daily_stats (
  ad_id uuid not null references public.ads (id) on delete cascade,
  day date not null,
  impressions integer not null default 0,
  clicks integer not null default 0,
  primary key (ad_id, day)
);
-- ... counting each player at most once per ad, per day, per kind.
create table if not exists public.ad_seen (
  ad_id uuid not null references public.ads (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('view', 'click')),
  primary key (ad_id, player_id, day, kind)
);
alter table public.ad_daily_stats enable row level security;
alter table public.ad_seen enable row level security;
revoke all on public.ad_daily_stats, public.ad_seen from anon, authenticated;

-- Ads that may show right now on this campus (never the destination link: that is
-- handed out only when someone clicks, so every click is counted).
create or replace function public.live_ads(p_university uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'placement', a.placement, 'advertiser', a.advertiser,
           'headline', a.headline, 'subline', a.subline, 'price_text', a.price_text,
           'bg_color', a.bg_color, 'fg_color', a.fg_color,
           'has_link', a.destination_url is not null, 'weight', a.weight)
         order by a.placement, a.weight desc, a.created_at), '[]'::jsonb)
  from (
    select *, row_number() over (partition by placement order by weight desc, created_at) as rn
    from public.ads
    where status = 'active'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (university_id is null or university_id = p_university)
  ) a
  where a.rn <= 12
$$;
revoke all on function public.live_ads(uuid) from public, anon, authenticated;

-- A player saw or clicked an ad. Returns the link for clicks on live ads.
create or replace function public.record_ad_event(p_user_id uuid, p_ad uuid, p_kind text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_ad public.ads%rowtype; v_rows int; v_today date;
begin
  v_player := public.active_player_id(p_user_id);
  if p_kind not in ('view', 'click') then raise exception 'bad kind'; end if;
  if not public.rate_limit_hit('ads:u:' || p_user_id, 60, 60) then raise exception 'slow down'; end if;

  select * into v_ad from public.ads
  where id = p_ad and status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now());
  if not found then return null; end if;

  v_today := (now() at time zone 'Africa/Lagos')::date;
  insert into public.ad_seen (ad_id, player_id, day, kind)
  values (p_ad, v_player, v_today, p_kind)
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    insert into public.ad_daily_stats (ad_id, day, impressions, clicks)
    values (p_ad, v_today, case when p_kind = 'view' then 1 else 0 end,
                           case when p_kind = 'click' then 1 else 0 end)
    on conflict (ad_id, day) do update set
      impressions = public.ad_daily_stats.impressions + excluded.impressions,
      clicks = public.ad_daily_stats.clicks + excluded.clicks;
  end if;

  if random() < 0.005 then
    delete from public.ad_seen where day < v_today - 30;
  end if;

  return case when p_kind = 'click' then v_ad.destination_url end;
end $$;

revoke all on function public.record_ad_event(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_ad_event(uuid, uuid, text) to service_role;

-- The game state now carries the live ads too (still ONE call).
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
      from public.interaction_types i where i.is_active),
    'ads', public.live_ads(v_enr.university_id)
  ) || public.game_dynamic(v_player.id);
end $$;
