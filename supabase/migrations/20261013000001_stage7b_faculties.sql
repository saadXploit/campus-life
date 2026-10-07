-- CAMPUS LIFE: Stage 7B - faculties in 3D
-- The game state now names your faculty and department, and lists every faculty
-- on your campus so each one can be drawn as its own building.
-- Safe to run more than once.

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
      'id', v_player.id, 'name', v_player.display_name,
      'skin', v_player.avatar_skin, 'hair_style', v_player.avatar_hair_style,
      'hair_color', v_player.avatar_hair_color, 'outfit', v_player.avatar_outfit),
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
    'ads', public.live_ads(v_enr.university_id)
  ) || public.game_dynamic(v_player.id);
end $$;
