-- CAMPUS LIFE: Stage 3B - start of a new campus day (lazy, per player)

create function public.ensure_today(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_clock public.world_clock%rowtype; v_day int;
  v_state public.player_state%rowtype; v_home uuid;
  v_missed int; v_drift int; v_energy int; v_health int; v_happy int;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select * into v_clock from public.world_clock;
  v_day := greatest(0, floor(
    extract(epoch from (now() - v_clock.epoch)) / (v_clock.day_length_minutes * 60)
  ))::int + 1;

  select l.id into v_home
  from public.enrollments e
  join public.locations l on l.university_id = e.university_id and l.kind = 'hostel'
  where e.player_id = v_player and e.status = 'active';
  if v_home is null then raise exception 'not enrolled'; end if;

  insert into public.player_state (player_id, location_id)
  values (v_player, v_home)
  on conflict (player_id) do nothing;

  select * into v_state from public.player_state where player_id = v_player for update;
  if v_state.day_number >= v_day then return; end if;

  v_energy := v_state.energy;
  v_health := v_state.health;
  v_happy := v_state.happiness;

  if v_state.day_number > 0 then
    if not v_state.slept_today then
      v_energy := v_energy - 20;
      v_happy := v_happy - 5;
      v_health := v_health - 3;
    end if;

    v_missed := v_day - v_state.day_number - 1;
    if v_missed > 0 then
      v_drift := least(v_missed, 3);
      v_happy := v_happy - 3 * v_drift;
      v_health := v_health - v_drift;
      v_energy := greatest(v_energy, 60);
    end if;
  end if;

  update public.player_state set
    energy = greatest(0, least(100, v_energy)),
    health = greatest(0, least(100, v_health)),
    happiness = greatest(0, least(100, v_happy)),
    day_number = v_day,
    hours_left = v_clock.hours_per_day,
    slept_today = false,
    location_id = v_home,
    updated_at = now()
  where player_id = v_player;
end $$;

revoke all on function public.ensure_today(uuid) from public, anon, authenticated;
grant execute on function public.ensure_today(uuid) to service_role;