-- CAMPUS LIFE: Stage 3C - travel between campus locations

create function public.travel_to(p_user_id uuid, p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_uni uuid; v_clock public.world_clock%rowtype; v_day int;
  v_state public.player_state%rowtype;
  v_from public.locations%rowtype; v_to public.locations%rowtype;
  v_dist numeric; v_hours numeric; v_cost int;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select e.university_id into v_uni
  from public.enrollments e where e.player_id = v_player and e.status = 'active';
  if v_uni is null then raise exception 'not enrolled'; end if;

  select * into v_state from public.player_state where player_id = v_player for update;
  if not found then raise exception 'no state'; end if;

  select * into v_clock from public.world_clock;
  v_day := greatest(0, floor(
    extract(epoch from (now() - v_clock.epoch)) / (v_clock.day_length_minutes * 60)
  ))::int + 1;
  if v_state.day_number < v_day then raise exception 'new day pending'; end if;

  select * into v_from from public.locations where id = v_state.location_id;
  select * into v_to from public.locations
  where id = p_location_id and university_id = v_uni;
  if not found then raise exception 'unknown location'; end if;
  if v_from.id = v_to.id then raise exception 'already there'; end if;

  v_dist := sqrt(power(v_from.map_x - v_to.map_x, 2) + power(v_from.map_y - v_to.map_y, 2));
  v_hours := greatest(1, ceil(v_dist / 30.0)) * 0.25;
  v_cost := ceil(v_hours * 2)::int;

  if v_state.hours_left < v_hours then raise exception 'not enough time'; end if;
  if v_state.energy < v_cost then raise exception 'too tired'; end if;

  update public.player_state set
    location_id = v_to.id,
    hours_left = hours_left - v_hours,
    energy = energy - v_cost,
    updated_at = now()
  where player_id = v_player;

  return jsonb_build_object('hours', v_hours, 'energy_cost', v_cost);
end $$;

revoke all on function public.travel_to(uuid, uuid) from public, anon, authenticated;
grant execute on function public.travel_to(uuid, uuid) to service_role;