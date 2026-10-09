-- CAMPUS LIFE: Stage 18 - three universities
-- The game now has three universities, one of each type:
--   Federal Universities of Nigeria, State Universities of Nigeria, Private Universities of Nigeria
-- (the three original campuses, renamed). Every student, application and record at any
-- other university moves to the one of the same type, on the same course, keeping their
-- level, grades, money, friends and chats. The other universities are switched off, not
-- deleted. Everything below runs as one step: if anything fails, nothing changes.
-- Safe to run more than once.

do $$
declare r record; v_keep_campus uuid; v_moved int;
begin
  -- ---------- 1. The three universities ----------
  update public.universities set
    name = 'Federal Universities of Nigeria', short_name = 'FUN', is_active = true,
    tagline = 'Low fees, big name, the whole country in one place.',
    description = 'Nigeria''s federal universities: low fees and a name that carries weight, but thousands compete for every seat. Lecture halls overflow, the market behind the main gate never sleeps, and lecturers can go on strike.'
  where slug = 'savannah-plateau';
  update public.universities set
    name = 'State Universities of Nigeria', short_name = 'SUN', is_active = true,
    tagline = 'Close-knit, affordable, loud on match day.',
    description = 'Nigeria''s state universities: moderate fees, a friendly local feel and kind rent. Quiet during the week, wild when the home team plays. Strikes are possible.'
  where slug = 'hilltop-state';
  update public.universities set
    name = 'Private Universities of Nigeria', short_name = 'PUN', is_active = true,
    tagline = 'Polished, pricey, plenty of connections.',
    description = 'Nigeria''s private universities: small classes, manicured lawns and well-connected classmates. Fees are high, there are no strikes, and the hostel gate closes at 11 PM.'
  where slug = 'crestfield';

  -- Which university each other one joins (same type).
  create temp table if not exists _uni_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _uni_map;
  insert into _uni_map (old_id, new_id)
  select u.id, k.id
  from public.universities u
  join public.universities k on k.type = u.type and k.slug in ('savannah-plateau', 'hilltop-state', 'crestfield')
  where u.id <> k.id and u.slug not in ('savannah-plateau', 'hilltop-state', 'crestfield');

  -- ---------- 2. Every course offered elsewhere is also offered at the one it joins ----------
  insert into public.faculties (university_id, name)
  select distinct m.new_id, f.name
  from _uni_map m join public.faculties f on f.university_id = m.old_id
  on conflict (university_id, name) do nothing;

  insert into public.departments (faculty_id, name)
  select distinct kf.id, d.name
  from _uni_map m
  join public.faculties f on f.university_id = m.old_id
  join public.departments d on d.faculty_id = f.id
  join public.faculties kf on kf.university_id = m.new_id and kf.name = f.name
  on conflict (faculty_id, name) do nothing;

  insert into public.courses (department_id, name, code, duration_years, cutoff_score)
  select distinct on (kd.id, c.name) kd.id, c.name, c.code, c.duration_years, c.cutoff_score
  from _uni_map m
  join public.faculties f on f.university_id = m.old_id
  join public.departments d on d.faculty_id = f.id
  join public.courses c on c.department_id = d.id
  join public.faculties kf on kf.university_id = m.new_id and kf.name = f.name
  join public.departments kd on kd.faculty_id = kf.id and kd.name = d.name
  order by kd.id, c.name
  on conflict (department_id, name) do nothing;

  -- Old course -> the same course at the university it joins.
  create temp table if not exists _course_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _course_map;
  insert into _course_map (old_id, new_id)
  select c.id, kc.id
  from _uni_map m
  join public.faculties f on f.university_id = m.old_id
  join public.departments d on d.faculty_id = f.id
  join public.courses c on c.department_id = d.id
  join public.faculties kf on kf.university_id = m.new_id and kf.name = f.name
  join public.departments kd on kd.faculty_id = kf.id and kd.name = d.name
  join public.courses kc on kc.department_id = kd.id and kc.name = c.name;

  -- Old campus place -> the same kind of place on the campus it joins.
  create temp table if not exists _loc_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _loc_map;
  insert into _loc_map (old_id, new_id)
  select l.id, kl.id
  from _uni_map m
  join public.locations l on l.university_id = m.old_id
  join public.locations kl on kl.university_id = m.new_id and kl.kind = l.kind;

  -- Students who are moving (for new hostel rooms and a notification).
  create temp table if not exists _moved (player_id uuid primary key, new_uni uuid not null) on commit drop;
  delete from _moved;
  insert into _moved (player_id, new_uni)
  select distinct on (e.player_id) e.player_id, m.new_id
  from public.enrollments e join _uni_map m on m.old_id = e.university_id
  order by e.player_id, e.enrolled_at desc;

  -- ---------- 3. Applications ----------
  -- If someone chose two universities that are now the same one, keep their higher choice.
  delete from public.application_choices c
  where exists (
    select 1 from public.application_choices c2
    where c2.application_id = c.application_id and c2.rank < c.rank
      and coalesce((select new_id from _uni_map where old_id = c2.university_id), c2.university_id)
        = coalesce((select new_id from _uni_map where old_id = c.university_id), c.university_id));

  update public.application_choices c set
    university_id = m.new_id,
    course_id = coalesce((select new_id from _course_map where old_id = c.course_id), c.course_id)
  from _uni_map m where c.university_id = m.old_id;

  update public.application_results ar set
    university_id = m.new_id,
    course_id = coalesce((select new_id from _course_map where old_id = ar.course_id), ar.course_id)
  from _uni_map m where ar.university_id = m.old_id;

  -- ---------- 4. Students and their records ----------
  update public.enrollments e set
    university_id = m.new_id,
    course_id = coalesce((select new_id from _course_map where old_id = e.course_id), e.course_id)
  from _uni_map m where e.university_id = m.old_id;

  update public.semester_registrations s set university_id = m.new_id
  from _uni_map m where s.university_id = m.old_id;

  -- Where each player is standing, outings and lift offers.
  update public.player_state s set location_id = lm.new_id, shard = 1
  from _loc_map lm where s.location_id = lm.old_id;
  update public.outings o set location_id = lm.new_id from _loc_map lm where o.location_id = lm.old_id;
  update public.rides x set location_id = lm.new_id from _loc_map lm where x.location_id = lm.old_id;
  delete from public.place_events ev using _loc_map lm where ev.location_id = lm.old_id;

  -- Ads and strikes aimed at a merged campus now aim at the one it joined.
  update public.ads a set university_id = m.new_id from _uni_map m where a.university_id = m.old_id;
  update public.strikes s set university_id = m.new_id from _uni_map m where s.university_id = m.old_id;
  delete from public.presence_counts p using _uni_map m where p.university_id = m.old_id;

  -- ---------- 5. One campus chat per university (messages and members kept) ----------
  for r in
    select c.id, m.new_id from public.conversations c join _uni_map m on m.old_id = c.university_id
    where c.kind = 'campus'
  loop
    select id into v_keep_campus from public.conversations where kind = 'campus' and university_id = r.new_id;
    if v_keep_campus is null then
      update public.conversations set university_id = r.new_id where id = r.id;
    else
      update public.messages set conversation_id = v_keep_campus where conversation_id = r.id;
      insert into public.conversation_members (conversation_id, player_id, role, joined_at, last_read_id, muted)
      select v_keep_campus, player_id, 'member', joined_at, last_read_id, muted
      from public.conversation_members where conversation_id = r.id
      on conflict (conversation_id, player_id) do nothing;
      delete from public.conversations where id = r.id;
    end if;
  end loop;

  -- ---------- 6. New hostel rooms for students who moved ----------
  update public.players p set hostel_room = null from _moved mv where p.id = mv.player_id;
  for r in select player_id from _moved loop
    perform public.assign_hostel_room(r.player_id);
  end loop;
  update public.player_state s set shard = p.hostel_room
  from _moved mv, public.players p, public.locations l
  where s.player_id = mv.player_id and p.id = mv.player_id and l.id = s.location_id and l.kind = 'hostel';

  insert into public.notifications (player_id, kind, title, body)
  select mv.player_id, 'results', '🏛️ Welcome to ' || u.name,
         'Your university is now part of ' || u.name || '. Your course, level, grades, money and friends are all still yours.'
  from _moved mv join public.universities u on u.id = mv.new_uni;
  get diagnostics v_moved = row_count;
  raise notice 'Students moved: %', v_moved;

  -- ---------- 7. The other universities are switched off ----------
  update public.universities u set is_active = false from _uni_map m where u.id = m.old_id;
end $$;
