-- CAMPUS LIFE: Stage 3E - waking up whenever you like
-- Safe to run more than once.
-- Waking starts your next day straight away. You can be at most ONE day ahead of the
-- shared campus calendar, so nobody can sleep-wake-sleep to farm extra days.

create or replace function public.wake_up(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_clock public.world_clock%rowtype; v_day int;
  v_state public.player_state%rowtype; v_home uuid;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select * into v_state from public.player_state where player_id = v_player for update;
  if not found then raise exception 'no state'; end if;
  if not v_state.slept_today then raise exception 'not asleep'; end if;

  select * into v_clock from public.world_clock;
  v_day := greatest(0, floor(
    extract(epoch from (now() - v_clock.epoch)) / (v_clock.day_length_minutes * 60)
  ))::int + 1;
  if v_state.day_number > v_day then raise exception 'too early'; end if;

  select l.id into v_home
  from public.enrollments e
  join public.locations l on l.university_id = e.university_id and l.kind = 'hostel'
  where e.player_id = v_player and e.status = 'active';

  -- They slept, so there is no tiredness penalty. Energy already went up when they went to bed.
  update public.player_state set
    day_number = v_day + 1,
    hours_left = v_clock.hours_per_day,
    slept_today = false,
    location_id = coalesce(v_home, location_id),
    updated_at = now()
  where player_id = v_player;
end $$;

revoke all on function public.wake_up(uuid) from public, anon, authenticated;
grant execute on function public.wake_up(uuid) to service_role;
