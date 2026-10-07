-- CAMPUS LIFE: Stage 4A - economy: protected ledger, transfers, notifications, settings
-- Safe to run more than once.

-- =====================================================
-- Settings staff can change without a code release
-- =====================================================
create table if not exists public.app_config (
  key text primary key check (key ~ '^[a-z_]{2,60}$'),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value) values
  ('registration_open', 'true'),
  ('transfer_min_account_age_hours', '24'),
  ('transfer_max_kobo', '10000000'),
  ('transfer_daily_max_kobo', '20000000'),
  ('transfer_daily_count', '20')
on conflict (key) do nothing;

create or replace function public.config_number(p_key text, p_default numeric)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.app_config where key = p_key),
    p_default)
$$;

create or replace function public.config_bool(p_key text, p_default boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.app_config where key = p_key),
    p_default)
$$;

revoke all on function public.config_number(text, numeric) from public, anon, authenticated;
revoke all on function public.config_bool(text, boolean) from public, anon, authenticated;

-- =====================================================
-- The ledger: can never be edited, deleted or emptied
-- =====================================================
alter table public.transactions drop constraint if exists transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('game', 'purchase', 'admin', 'transfer'));
alter table public.transactions add column if not exists reference_id uuid;
-- No foreign key on purpose: history must survive even if the other player is removed.
alter table public.transactions add column if not exists counterparty_player_id uuid;

-- Deleting a wallet that has history is refused, so money history is never lost.
alter table public.transactions drop constraint if exists transactions_wallet_id_fkey;
alter table public.transactions add constraint transactions_wallet_id_fkey
  foreign key (wallet_id) references public.wallets (id) on delete restrict;

create or replace trigger transactions_no_delete
  before delete on public.transactions
  for each row execute function public.transactions_append_only();
create or replace trigger transactions_no_truncate
  before truncate on public.transactions
  for each statement execute function public.transactions_append_only();

-- The single way a balance changes, now with a source, reference and other party.
drop function if exists public.wallet_apply(uuid, bigint, text, text);
create or replace function public.wallet_apply(
  p_player_id uuid, p_amount_kobo bigint, p_kind text, p_description text,
  p_source text default 'game', p_reference uuid default null, p_counterparty uuid default null
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_wallet uuid; v_balance bigint;
begin
  if p_amount_kobo is null or p_amount_kobo = 0 then raise exception 'bad amount'; end if;

  update public.wallets
  set balance_kobo = balance_kobo + p_amount_kobo, updated_at = now()
  where player_id = p_player_id and balance_kobo + p_amount_kobo >= 0
  returning id, balance_kobo into v_wallet, v_balance;

  if v_wallet is null then
    if exists (select 1 from public.wallets where player_id = p_player_id) then
      raise exception 'not enough money';
    end if;
    raise exception 'no wallet';
  end if;

  insert into public.transactions
    (wallet_id, amount_kobo, balance_after_kobo, kind, source, description,
     reference_id, counterparty_player_id)
  values (v_wallet, p_amount_kobo, v_balance, p_kind, p_source, left(p_description, 200),
     p_reference, p_counterparty);

  return v_balance;
end $$;

revoke all on function public.wallet_apply(uuid, bigint, text, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;

-- =====================================================
-- Notifications
-- =====================================================
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (length(kind) between 2 and 40),
  title text not null check (length(title) <= 120),
  body text check (length(body) <= 300),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_player_idx
  on public.notifications (player_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (player_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.id = player_id and p.user_id = (select auth.uid())));

-- Marks everything read, and clears read notifications older than 60 days.
create or replace function public.mark_notifications_read(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then return; end if;
  update public.notifications set read_at = now()
  where player_id = v_player and read_at is null;
  delete from public.notifications
  where player_id = v_player and read_at < now() - interval '60 days';
end $$;

-- =====================================================
-- Player-to-player transfers
-- =====================================================
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_player_id uuid not null references public.players (id) on delete restrict,
  to_player_id uuid not null references public.players (id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  note text check (length(note) <= 80),
  idempotency_key text not null check (length(idempotency_key) between 8 and 64),
  created_at timestamptz not null default now(),
  check (from_player_id <> to_player_id),
  unique (from_player_id, idempotency_key)
);
create index if not exists transfers_from_idx on public.transfers (from_player_id, created_at desc);
create index if not exists transfers_to_idx on public.transfers (to_player_id, created_at desc);

alter table public.transfers enable row level security;
revoke all on public.transfers from anon, authenticated;
grant select on public.transfers to authenticated;
drop policy if exists "transfers: read own" on public.transfers;
create policy "transfers: read own" on public.transfers
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.user_id = (select auth.uid()) and p.id in (from_player_id, to_player_id)));

-- Fast "name starts with" search.
create index if not exists players_display_name_prefix_idx
  on public.players (lower(display_name) text_pattern_ops);

-- Finds players by the start of their name. Never returns the caller.
create or replace function public.search_players(p_user_id uuid, p_query text)
returns table (player_id uuid, display_name text, university text)
language plpgsql stable security definer set search_path = ''
as $$
declare v_q text;
begin
  v_q := lower(trim(coalesce(p_query, '')));
  if length(v_q) < 2 or length(v_q) > 20 then return; end if;
  v_q := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');

  return query
    select p.id, p.display_name, u.short_name
    from public.players p
    join public.profiles pr on pr.id = p.user_id and pr.status = 'active'
    left join public.enrollments e on e.player_id = p.id and e.status = 'active'
    left join public.universities u on u.id = e.university_id
    where lower(p.display_name) like v_q || '%'
      and p.user_id <> p_user_id
    order by lower(p.display_name)
    limit 10;
end $$;

create or replace function public.transfer_cash(
  p_user_id uuid, p_to_player uuid, p_amount_kobo bigint, p_note text, p_key text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_from public.players%rowtype; v_to public.players%rowtype;
  v_existing uuid; v_id uuid; v_balance bigint; v_note text;
  v_sent bigint; v_count int;
begin
  select * into v_from from public.players where user_id = p_user_id;
  if not found then raise exception 'no character'; end if;

  -- The same request sent twice (double tap, retry) moves money only once.
  select id into v_existing from public.transfers
  where from_player_id = v_from.id and idempotency_key = p_key;
  if v_existing is not null then
    return jsonb_build_object('transfer_id', v_existing, 'duplicate', true);
  end if;

  if p_amount_kobo is null or p_amount_kobo < 100 then raise exception 'amount too small'; end if;
  if p_amount_kobo % 100 <> 0 then raise exception 'whole naira only'; end if;
  if p_amount_kobo > public.config_number('transfer_max_kobo', 10000000) then
    raise exception 'amount too large';
  end if;
  if p_to_player = v_from.id then raise exception 'cannot send to yourself'; end if;

  select * into v_to from public.players where id = p_to_player;
  if not found then raise exception 'unknown recipient'; end if;
  if exists (select 1 from public.profiles where id = v_to.user_id and status <> 'active') then
    raise exception 'recipient unavailable';
  end if;
  if v_from.created_at > now() - make_interval(
       hours => public.config_number('transfer_min_account_age_hours', 24)::int) then
    raise exception 'account too new';
  end if;

  -- Lock both wallets in a fixed order so two opposite transfers cannot deadlock.
  perform 1 from public.wallets
  where player_id in (v_from.id, v_to.id) order by id for update;

  -- Checked after locking, so parallel requests cannot slip past the daily limits.
  select coalesce(sum(amount_kobo), 0), count(*) into v_sent, v_count
  from public.transfers
  where from_player_id = v_from.id and created_at > now() - interval '24 hours';
  if v_count >= public.config_number('transfer_daily_count', 20) then
    raise exception 'daily transfer limit';
  end if;
  if v_sent + p_amount_kobo > public.config_number('transfer_daily_max_kobo', 20000000) then
    raise exception 'daily amount limit';
  end if;

  v_note := nullif(left(trim(coalesce(p_note, '')), 80), '');

  insert into public.transfers (from_player_id, to_player_id, amount_kobo, note, idempotency_key)
  values (v_from.id, v_to.id, p_amount_kobo, v_note, p_key)
  returning id into v_id;

  v_balance := public.wallet_apply(v_from.id, -p_amount_kobo, 'transfer_out',
    'Sent to ' || v_to.display_name, 'transfer', v_id, v_to.id);
  perform public.wallet_apply(v_to.id, p_amount_kobo, 'transfer_in',
    'From ' || v_from.display_name, 'transfer', v_id, v_from.id);

  insert into public.notifications (player_id, kind, title, body, data)
  values (v_to.id, 'transfer_received',
    v_from.display_name || ' sent you ₦' || to_char(p_amount_kobo / 100, 'FM999,999,999,990'),
    v_note,
    jsonb_build_object('transfer_id', v_id, 'amount_kobo', p_amount_kobo,
                       'from', v_from.display_name));

  return jsonb_build_object('transfer_id', v_id, 'balance_kobo', v_balance, 'duplicate', false);
end $$;

-- =====================================================
-- Staff money adjustments (audited in the same step)
-- =====================================================
create or replace function public.admin_adjust_wallet(
  p_actor uuid, p_actor_handle text, p_player uuid, p_amount_kobo bigint, p_reason text
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare v_balance bigint; v_name text;
begin
  if p_amount_kobo is null or p_amount_kobo = 0 then raise exception 'bad amount'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'reason required'; end if;
  select display_name into v_name from public.players where id = p_player;
  if v_name is null then raise exception 'unknown player'; end if;

  v_balance := public.wallet_apply(p_player, p_amount_kobo,
    case when p_amount_kobo > 0 then 'admin_grant' else 'admin_debit' end,
    left('Campus office: ' || trim(p_reason), 200), 'admin', null, null);

  insert into public.admin_actions
    (actor_user_id, actor_handle, action, target_type, target_id, reason, metadata)
  values (p_actor, p_actor_handle, 'ECONOMY_ADJUSTMENT', 'player', p_player::text, trim(p_reason),
    jsonb_build_object('amount_kobo', p_amount_kobo, 'balance_after_kobo', v_balance,
                       'player', v_name));

  insert into public.notifications (player_id, kind, title, body)
  values (p_player, 'admin_adjustment',
    case when p_amount_kobo > 0
      then 'The campus office credited you ₦' || to_char(p_amount_kobo / 100, 'FM999,999,999,990')
      else 'The campus office debited ₦' || to_char(-p_amount_kobo / 100, 'FM999,999,999,990')
    end,
    left(trim(p_reason), 300));

  return v_balance;
end $$;

-- =====================================================
-- Pausing new registrations (existing players keep playing)
-- =====================================================
create or replace function public.create_player(
  p_user_id uuid, p_display_name text, p_age smallint, p_gender text,
  p_skin smallint, p_hair_style smallint, p_hair_color smallint, p_outfit smallint,
  p_background text, p_interest text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_wallet uuid; v_amount bigint;
begin
  if not public.config_bool('registration_open', true) then
    raise exception 'registration closed';
  end if;

  select starting_wallet_kobo into v_amount
  from public.backgrounds where slug = p_background and is_active;
  if v_amount is null then raise exception 'unknown background'; end if;

  insert into public.players (user_id, display_name, age, gender, avatar_skin,
    avatar_hair_style, avatar_hair_color, avatar_outfit, background_slug, interest)
  values (p_user_id, p_display_name, p_age, p_gender::public.gender, p_skin,
    p_hair_style, p_hair_color, p_outfit, p_background, p_interest)
  returning id into v_player;

  insert into public.wallets (player_id, balance_kobo)
  values (v_player, v_amount) returning id into v_wallet;

  insert into public.transactions
    (wallet_id, amount_kobo, balance_after_kobo, kind, source, description)
  values (v_wallet, v_amount, v_amount, 'opening_balance', 'game', 'Starting money');

  return v_player;
end $$;

-- =====================================================
-- Who may call what: only our trusted server
-- =====================================================
revoke all on function public.mark_notifications_read(uuid) from public, anon, authenticated;
revoke all on function public.search_players(uuid, text) from public, anon, authenticated;
revoke all on function public.transfer_cash(uuid, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.admin_adjust_wallet(uuid, text, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.mark_notifications_read(uuid) to service_role;
grant execute on function public.search_players(uuid, text) to service_role;
grant execute on function public.transfer_cash(uuid, uuid, bigint, text, text) to service_role;
grant execute on function public.admin_adjust_wallet(uuid, text, uuid, bigint, text) to service_role;
