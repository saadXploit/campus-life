-- CAMPUS LIFE: Stage 16 - shorter semesters, daily lectures
-- A semester is now 2 weeks: 10 days of lectures, 2 days of exams, 2 days of holiday
-- (was 3 weeks + 1 week + 1 week). Every course meets twice a day instead of twice a
-- week, and attending half of the lectures held counts as full attendance.
-- The semester running now keeps its start date, so nobody loses progress.
-- School fees and rent are due 5 days into the semester.
-- Safe to run more than once.

do $$
declare v_now record; v_cycle int := 14;
begin
  -- Where we are under the current calendar...
  select * into v_now from public.academic_now();

  update public.app_config set value = to_jsonb(10) where key = 'lecture_days';
  update public.app_config set value = to_jsonb(2) where key = 'exam_days';
  update public.app_config set value = to_jsonb(2) where key = 'holiday_days';

  -- ...so that this semester keeps its number and its start date under the new lengths.
  insert into public.app_config (key, value)
  values ('academic_epoch', to_jsonb((v_now.sem_start - make_interval(days => v_now.idx * v_cycle))::text))
  on conflict (key) do update set value = excluded.value;
end $$;

insert into public.app_config (key, value) values
  ('lectures_daily', 'true'),
  ('attendance_target_percent', '50')
on conflict (key) do nothing;
update public.app_config set value = to_jsonb(5) where key = 'fees_due_days';

-- Lecture times. With daily lectures every course meets at its two times every day;
-- otherwise only on its two weekdays.
create or replace function public.lecture_starts(p_dow smallint, p_hour smallint, p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql stable security definer set search_path = ''
as $$
  select s from (
    select ((d::date + make_time(p_hour, 0, 0)) at time zone 'Africa/Lagos') as s
    from generate_series((p_from at time zone 'Africa/Lagos')::date,
                         (p_to at time zone 'Africa/Lagos')::date, interval '1 day') d
    where public.config_bool('lectures_daily', true) or extract(isodow from d) = p_dow
  ) x
  where s >= p_from and s <= p_to
$$;

-- Bills already created for this semester follow the new, earlier due date.
update public.bills b set due_at = n.sem_start + interval '5 days'
from (select * from public.academic_now()) n
where b.semester_idx = n.idx and b.paid_at is null and b.late_fee_kobo = 0;

-- ---------- Grades: half the lectures held counts as full attendance ----------

create or replace function public.grade_semester(p_player uuid, p_idx int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_reg public.semester_registrations%rowtype; b record; v_uni record; v_bonus int;
  r record; v_held int; v_att int; a numeric; v_ca int; v_ex int; v_sc int; v_g text; v_gp int;
  v_units int := 0; v_points int := 0; v_gpa numeric;
begin
  select * into v_reg from public.semester_registrations
  where player_id = p_player and semester_idx = p_idx for update;
  if not found or v_reg.status <> 'active' then return; end if;

  select * into b from public.semester_bounds(p_idx);
  select type, difficulty into v_uni from public.universities where id = v_reg.university_id;
  select bg.academic_bonus into v_bonus
  from public.players p join public.backgrounds bg on bg.slug = p.background_slug where p.id = p_player;

  for r in
    select mr.*, m.units from public.module_records mr
    join public.modules m on m.code = mr.module_code
    where mr.player_id = p_player and mr.semester_idx = p_idx
  loop
    v_held := public.lectures_held(r.module_code, v_reg.university_id,
                                   greatest(b.sem_start, v_reg.registered_at), b.lectures_end);
    select count(*) into v_att from public.lecture_attendance
    where player_id = p_player and module_code = r.module_code and semester_idx = p_idx;
    -- Full attendance means attending the target share of the lectures held (default half).
    a := case when v_held = 0 then 1
              else least(1, v_att::numeric / greatest(1, ceil(v_held * public.config_number('attendance_target_percent', 50) / 100.0))) end;

    -- Continuous assessment (out of 30): turning up and studying.
    v_ca := least(30, round(a * 20 + r.study_points))::int;
    -- Exam (out of 70): preparation, attendance, background, how you felt, how hard the school is.
    if r.exam_written_at is null then
      v_ex := 0;
    else
      v_ex := greatest(0, least(70, round(
        20 + r.study_points * 3 + a * 15 + coalesce(v_bonus, 0) * 2
        + coalesce(r.exam_energy, 50) / 100.0 * 6 + coalesce(r.exam_health, 50) / 100.0 * 4
        - (v_uni.difficulty - 5) * 1.5
        + case when v_uni.type = 'private' then 3 else 0 end
        + (random() * 12 - 6))))::int;
      -- Walking out of an exam early cuts the mark.
      v_ex := round(v_ex * coalesce(r.exam_done, 1))::int;
    end if;
    v_sc := v_ca + v_ex;
    -- Nigerian 5-point scale.
    v_g := case when v_sc >= 70 then 'A' when v_sc >= 60 then 'B' when v_sc >= 50 then 'C'
                when v_sc >= 45 then 'D' when v_sc >= 40 then 'E' else 'F' end;
    v_gp := case v_g when 'A' then 5 when 'B' then 4 when 'C' then 3 when 'D' then 2 when 'E' then 1 else 0 end;

    update public.module_records set ca = v_ca, exam = v_ex, score = v_sc, grade = v_g, grade_point = v_gp
    where player_id = p_player and semester_idx = p_idx and module_code = r.module_code;

    v_units := v_units + r.units;
    v_points := v_points + v_gp * r.units;
  end loop;

  v_gpa := case when v_units > 0 then round(v_points::numeric / v_units, 2) end;
  update public.semester_registrations
  set status = 'graded', gpa = v_gpa, units = v_units, graded_at = now()
  where player_id = p_player and semester_idx = p_idx;

  update public.enrollments set
    total_units = total_units + v_units,
    total_points = total_points + v_points,
    cgpa = case when total_units + v_units > 0
                then round((total_points + v_points)::numeric / (total_units + v_units), 2) end
  where player_id = p_player and status = 'active';

  insert into public.notifications (player_id, kind, title, body)
  values (p_player, 'results',
    'Your ' || case v_reg.semester_no when 1 then '1st' else '2nd' end || ' semester results are out',
    'GPA ' || coalesce(to_char(v_gpa, 'FM0.00'), '-') || ' · ' || v_reg.level_year || '00 Level');

  -- After second semester: next level, or graduation.
  if v_reg.semester_no = 2 then
    update public.enrollments e set level_year = e.level_year + 1
    from public.courses c
    where e.player_id = p_player and e.status = 'active' and c.id = e.course_id
      and e.level_year < c.duration_years;
    if not found then
      update public.enrollments set status = 'graduated'
      where player_id = p_player and status = 'active';
      insert into public.notifications (player_id, kind, title)
      values (p_player, 'graduated', 'You graduated! 🎓');
    end if;
  end if;
end $$;

-- ---------- The academics screen learns the new calendar ----------

create or replace function public.get_academics(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_now record; v_enr record; v_reg public.semester_registrations%rowtype; v_strike text;
begin
  v_player := public.active_player_id(p_user_id);
  perform public.sync_academics(v_player);
  select * into v_now from public.academic_now();

  select e.level_year, e.status, e.cgpa, e.total_units, e.university_id, u.type as uni_type,
         c.name as course, c.duration_years
  into v_enr
  from public.enrollments e
  join public.universities u on u.id = e.university_id
  join public.courses c on c.id = e.course_id
  where e.player_id = v_player and e.status in ('active', 'graduated')
  order by e.enrolled_at desc limit 1;

  select * into v_reg from public.semester_registrations
  where player_id = v_player and semester_idx = v_now.idx;

  v_strike := case when v_enr.university_id is not null then public.strike_at(v_enr.university_id, now()) end;

  return jsonb_build_object(
    'calendar', jsonb_build_object(
      'semester_idx', v_now.idx,
      'session', (2026 + floor(v_now.idx / 2.0)::int) || '/' || (2027 + floor(v_now.idx / 2.0)::int),
      'semester_no', (v_now.idx % 2) + 1,
      'phase', v_now.phase,
      'week', case when v_now.phase = 'lectures'
                   then floor(extract(epoch from (now() - v_now.sem_start)) / 604800)::int + 1 end,
      'day', case when v_now.phase = 'lectures'
                  then floor(extract(epoch from (now() - v_now.sem_start)) / 86400)::int + 1 end,
      'lecture_days', public.config_number('lecture_days', 10)::int,
      'daily_lectures', public.config_bool('lectures_daily', true),
      'attendance_target_percent', public.config_number('attendance_target_percent', 50)::int,
      'lectures_end', v_now.lectures_end, 'exams_end', v_now.exams_end,
      'holiday_end', v_now.holiday_end),
    'strike', v_strike,
    'level_year', v_enr.level_year,
    'status', v_enr.status,
    'cgpa', v_enr.cgpa,
    'total_units', v_enr.total_units,
    'course', v_enr.course,
    'uni_type', v_enr.uni_type,
    'registered', v_reg.player_id is not null,
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', m.code, 'title', m.title, 'units', m.units,
        'slots', jsonb_build_array(jsonb_build_array(m.slot1_dow, m.slot1_hour),
                                   jsonb_build_array(m.slot2_dow, m.slot2_hour)),
        'attended', (select count(*) from public.lecture_attendance la
                     where la.player_id = v_player and la.module_code = m.code
                       and la.semester_idx = v_now.idx),
        'held', public.lectures_held(m.code, v_reg.university_id,
                                     greatest(v_now.sem_start, v_reg.registered_at),
                                     least(now(), v_now.lectures_end)),
        'study_points', mr.study_points,
        'exam_written', mr.exam_written_at is not null,
        'live_lecture', case when v_now.phase = 'lectures' then public.live_lecture(m.code) end,
        'attended_live', exists (select 1 from public.lecture_attendance la
                                 where la.player_id = v_player and la.module_code = m.code
                                   and la.lecture_start = public.live_lecture(m.code))
      ) order by m.code)
      from public.module_records mr join public.modules m on m.code = mr.module_code
      where mr.player_id = v_player and mr.semester_idx = v_now.idx), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'semester_idx', r.semester_idx, 'semester_no', r.semester_no, 'level_year', r.level_year,
        'gpa', r.gpa, 'units', r.units,
        'modules', (select jsonb_agg(jsonb_build_object(
                      'code', mr.module_code, 'title', m.title, 'units', m.units,
                      'ca', mr.ca, 'exam', mr.exam, 'score', mr.score, 'grade', mr.grade)
                      order by mr.module_code)
                    from public.module_records mr join public.modules m on m.code = mr.module_code
                    where mr.player_id = v_player and mr.semester_idx = r.semester_idx)
      ) order by r.semester_idx desc)
      from (select * from public.semester_registrations
            where player_id = v_player and status = 'graded'
            order by semester_idx desc limit 8) r), '[]'::jsonb),
    'server_time', now()
  );
end $$;
