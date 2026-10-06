-- CAMPUS LIFE: Stage 2B - backgrounds, players, wallets, ledger

create type public.gender as enum ('female', 'male', 'nonbinary');

create table public.backgrounds (
  slug text primary key check (slug ~ '^[a-z-]{2,40}$'),
  name text not null check (length(name) between 2 and 60),
  blurb text not null check (length(blurb) <= 300),
  starting_wallet_kobo bigint not null check (starting_wallet_kobo > 0),
  academic_bonus smallint not null check (academic_bonus between 0 and 5),
  hustle_bonus smallint not null check (hustle_bonus between 0 and 5),
  social_bonus smallint not null check (social_bonus between 0 and 5),
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 3 and 20),
  age smallint not null check (age between 16 and 30),
  gender public.gender not null,
  avatar_skin smallint not null check (avatar_skin between 0 and 5),
  avatar_hair_style smallint not null check (avatar_hair_style between 0 and 5),
  avatar_hair_color smallint not null check (avatar_hair_color between 0 and 5),
  avatar_outfit smallint not null check (avatar_outfit between 0 and 5),
  background_slug text not null references public.backgrounds (slug),
  interest text not null check (interest in
    ('science','engineering','health','social','arts','law','management')),
  created_at timestamptz not null default now()
);
create unique index players_display_name_lower_idx on public.players (lower(display_name));

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players (id) on delete cascade,
  balance_kobo bigint not null default 0 check (balance_kobo >= 0),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id bigint generated always as identity primary key,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo <> 0),
  balance_after_kobo bigint not null check (balance_after_kobo >= 0),
  kind text not null check (length(kind) between 2 and 40),
  source text not null default 'game' check (source in ('game', 'purchase', 'admin')),
  description text not null check (length(description) <= 200),
  created_at timestamptz not null default now()
);
create index transactions_wallet_idx on public.transactions (wallet_id, created_at desc);

-- The ledger can never be edited.
create function public.transactions_append_only()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'transactions cannot be edited'; end $$;

create trigger transactions_no_update
  before update on public.transactions
  for each row execute function public.transactions_append_only();

-- Creates character + wallet + opening ledger entry in ONE step.
-- Only our trusted server can call this.
create function public.create_player(
  p_user_id uuid, p_display_name text, p_age smallint, p_gender text,
  p_skin smallint, p_hair_style smallint, p_hair_color smallint, p_outfit smallint,
  p_background text, p_interest text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_wallet uuid; v_amount bigint;
begin
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

revoke all on function public.create_player(uuid, text, smallint, text, smallint,
  smallint, smallint, smallint, text, text) from public, anon, authenticated;
grant execute on function public.create_player(uuid, text, smallint, text, smallint,
  smallint, smallint, smallint, text, text) to service_role;

-- Row Level Security: players can only READ their own data.
alter table public.backgrounds enable row level security;
alter table public.players enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;

revoke all on public.backgrounds, public.players, public.wallets, public.transactions
  from anon, authenticated;
grant select on public.backgrounds, public.players, public.wallets, public.transactions
  to authenticated;

create policy "backgrounds: read active" on public.backgrounds
  for select to authenticated using (is_active);

create policy "players: read own" on public.players
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "wallets: read own" on public.wallets
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.id = player_id and p.user_id = (select auth.uid())));

create policy "transactions: read own" on public.transactions
  for select to authenticated using (exists (
    select 1 from public.wallets w
    join public.players p on p.id = w.player_id
    where w.id = wallet_id and p.user_id = (select auth.uid())));

-- Starting backgrounds (money in kobo)
insert into public.backgrounds
  (slug, name, blurb, starting_wallet_kobo, academic_bonus, hustle_bonus, social_bonus, sort_order)
values
  ('scholarship-kid', 'Scholarship Kid',
   'Top of your class back home, with a scholarship letter and very little pocket money. Books are your edge.',
   1500000, 4, 1, 0, 1),
  ('village-to-city', 'Village-to-City',
   'First in your family to leave for the city. You know how to stretch a naira and spot an opportunity.',
   1500000, 1, 3, 1, 2),
  ('market-family', 'Market Family',
   'You grew up behind a stall. Haggling, customers and hard work are second nature.',
   3500000, 0, 3, 1, 3),
  ('sports-talent', 'Sports Talent',
   'Your football boots opened the door. Everyone knows your name before you know theirs.',
   3500000, 0, 1, 3, 4),
  ('business-family', 'Business Family',
   'Your parents run a growing business. You have a little cushion and a lot of expectations.',
   6000000, 1, 2, 0, 5),
  ('city-rich-kid', 'City Rich Kid',
   'Big-city comfort, a good phone, loud friends. The money is real; the discipline is not guaranteed.',
   9000000, 0, 0, 2, 6);