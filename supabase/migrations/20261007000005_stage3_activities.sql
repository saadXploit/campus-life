-- CAMPUS LIFE: Stage 3D - doing activities, and the single way money moves
-- Safe to run more than once.

-- Activities that end the day (sleep). Data, so new ones need no code change.
alter table public.activities add column if not exists ends_day boolean not null default false;
update public.activities set ends_day = true where slug = 'sleep';

-- THE only place a wallet balance changes. Always writes a ledger line in the same step.
-- Positive amount = money in, negative = money out. Never goes below zero.
-- Nobody can call it directly: only other trusted database functions use it.
create or replace function public.wallet_apply(
  p_player_id uuid, p_amount_kobo bigint, p_kind text, p_description text
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
    (wallet_id, amount_kobo, balance_after_kobo, kind, source, description)
  values (v_wallet, p_amount_kobo, v_balance, p_kind, 'game', left(p_description, 200));

  return v_balance;
end $$;

revoke all on function public.wallet_apply(uuid, bigint, text, text)
  from public, anon, authenticated, service_role;

-- Does one activity at the player's current location. The server decides every number.
create or replace function public.perform_activity(p_user_id uuid, p_activity text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_clock public.world_clock%rowtype; v_day int;
  v_state public.player_state%rowtype; v_act public.activities%rowtype;
  v_kind text; v_hours numeric;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select * into v_state from public.player_state where player_id = v_player for update;
  if not found then raise exception 'no state'; end if;

  select * into v_clock from public.world_clock;
  v_day := greatest(0, floor(
    extract(epoch from (now() - v_clock.epoch)) / (v_clock.day_length_minutes * 60)
  ))::int + 1;
  if v_state.day_number < v_day then raise exception 'new day pending'; end if;

  select * into v_act from public.activities where slug = p_activity and is_active;
  if not found then raise exception 'unknown activity'; end if;

  select kind into v_kind from public.locations where id = v_state.location_id;
  if v_kind is distinct from v_act.location_kind then raise exception 'wrong place'; end if;

  if v_act.ends_day then
    -- Going to bed is always possible (even with no hours left) and ends the day.
    if v_state.slept_today then raise exception 'already slept'; end if;
    v_hours := v_state.hours_left;
  else
    v_hours := v_act.duration_hours;
    if v_state.slept_today then raise exception 'already slept'; end if;
    if v_state.hours_left < v_hours then raise exception 'not enough time'; end if;
  end if;

  if v_act.energy_delta < 0 and v_state.energy < -v_act.energy_delta then
    raise exception 'too tired';
  end if;

  if v_act.cost_kobo > 0 then
    perform public.wallet_apply(v_player, -v_act.cost_kobo, 'activity', v_act.name);
  end if;

  update public.player_state set
    energy = greatest(0, least(100, energy + v_act.energy_delta)),
    health = greatest(0, least(100, health + v_act.health_delta)),
    happiness = greatest(0, least(100, happiness + v_act.happiness_delta)),
    hours_left = hours_left - v_hours,
    slept_today = slept_today or v_act.ends_day,
    updated_at = now()
  where player_id = v_player;

  return jsonb_build_object(
    'activity', v_act.slug,
    'hours', v_hours,
    'energy', v_act.energy_delta,
    'health', v_act.health_delta,
    'happiness', v_act.happiness_delta,
    'cost_kobo', v_act.cost_kobo
  );
end $$;

revoke all on function public.perform_activity(uuid, text) from public, anon, authenticated;
grant execute on function public.perform_activity(uuid, text) to service_role;
