-- CAMPUS LIFE: Stage 12 - leave any activity whenever you like
-- Players can stop what they are doing at any time: eating, playing, studying, a lecture,
-- an exam, a work shift, or sleep. Leaving early is always allowed, with a fair result:
--   * eating, sport and other activities: you keep only part of the benefit (no refunds)
--   * work: you are paid for the time you worked, with no bonus, and it does not count
--     towards a raise
--   * a lecture: it does not count as attended (you can go back in while it is still on)
--   * studying: that session does not count
--   * an exam: walking out cuts your exam mark by how much of it you missed
-- Safe to run more than once.

alter table public.work_shifts add column if not exists completed boolean not null default true;
alter table public.module_records add column if not exists exam_done numeric(3, 2) not null default 1
  check (exam_done between 0 and 1);

-- ---------- Pay: shifts left early are paid but do not count towards a raise ----------

create or replace function public.pay_job_shifts(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; v_before int; v_after int; v_total bigint;
begin
  for r in
    select w.*, j.name as job_name, j.boss_name
    from public.work_shifts w join public.jobs j on j.slug = w.job_slug
    where w.player_id = p_player and w.paid_at is null and w.ends_at <= now()
    order by w.id
    for update of w
  loop
    v_total := r.pay_kobo + r.bonus_kobo;
    if v_total > 0 then
      perform public.wallet_apply(p_player, v_total, 'salary', 'Pay: ' || r.job_name || ' shift');
    end if;
    update public.work_shifts set paid_at = now() where id = r.id;

    select shifts_done into v_before from public.player_jobs where player_id = p_player;
    update public.player_jobs set shifts_done = shifts_done + 1
    where player_id = p_player and job_slug = r.job_slug and r.completed
    returning shifts_done into v_after;

    if v_total > 0 then
      insert into public.notifications (player_id, kind, title, body)
      values (p_player, 'salary',
              '💰 ₦' || to_char(v_total / 100, 'FM999,999,990') || ' from ' || r.boss_name,
              r.boss_line);
    end if;

    if v_after is not null and public.job_rank(v_after) > public.job_rank(coalesce(v_before, 0)) then
      insert into public.notifications (player_id, kind, title, body)
      values (p_player, 'promotion',
              '🎉 Promoted to ' || case public.job_rank(v_after) when 3 then 'Senior ' else '' end || r.job_name,
              r.boss_name || ' gave you a raise. Every shift now pays more.');
    end if;
  end loop;
end $$;

-- ---------- Grades: walking out of an exam cuts the exam mark ----------

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
    a := case when v_held = 0 then 1 else least(1, v_att::numeric / v_held) end;

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

-- ---------- Stop whatever you are doing ----------

create or replace function public.stop_activity(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid; v_s public.player_state%rowtype; v_slug text; v_code text; v_kind text;
  v_total interval; v_left double precision; v_act public.activities%rowtype;
  v_w public.work_shifts%rowtype; v_worked double precision; v_pay bigint := null; v_now record;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('stop:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_me);

  select * into v_s from public.player_state where player_id = v_me for update;
  -- Sleeping: stopping means waking up.
  if v_s.asleep_since is not null then
    return public.wake_up(p_user_id);
  end if;
  if v_s.busy_until is null or v_s.busy_until <= now() then
    return public.game_dynamic(v_me);
  end if;

  v_slug := v_s.busy_activity;
  v_code := split_part(v_slug, ':', 2);
  select kind into v_kind from public.locations where id = v_s.location_id;

  if v_slug like 'work:%' then
    -- Paid for the time worked, no bonus, and it does not count towards a raise.
    select * into v_w from public.work_shifts
    where player_id = v_me and paid_at is null and ends_at > now()
    order by id desc limit 1 for update;
    if found then
      v_worked := greatest(0, least(1, extract(epoch from (now() - v_w.started_at))
                                     / greatest(1, extract(epoch from (v_w.ends_at - v_w.started_at)))));
      v_pay := (floor(v_w.pay_kobo * v_worked / 1000) * 1000)::bigint;
      update public.work_shifts set
        ends_at = now(), pay_kobo = v_pay, bonus_kobo = 0, completed = false,
        boss_line = 'You left early, so I paid you only for the time you worked.'
      where id = v_w.id;
    end if;

  elsif v_slug like 'lecture:%' then
    -- Leaving a lecture early: it does not count as attended.
    delete from public.lecture_attendance
    where player_id = v_me and module_code = v_code
      and lecture_start = (select max(lecture_start) from public.lecture_attendance
                           where player_id = v_me and module_code = v_code);

  elsif v_slug like 'study:%' then
    select * into v_now from public.academic_now();
    update public.module_records set study_points = greatest(0, study_points - 1)
    where player_id = v_me and semester_idx = v_now.idx and module_code = v_code;

  elsif v_slug like 'exam:%' then
    -- Walking out: the exam mark is cut by how much of the exam was missed.
    select * into v_now from public.academic_now();
    v_left := greatest(0, least(1, extract(epoch from (v_s.busy_until - now())) / 300.0));
    update public.module_records set exam_done = round((1 - v_left)::numeric, 2)
    where player_id = v_me and semester_idx = v_now.idx and module_code = v_code;

  else
    -- Ordinary activities: keep only the part of the benefit you stayed for.
    select * into v_act from public.activities where slug = v_slug;
    if found and v_act.duration_minutes > 0 then
      v_total := make_interval(secs => (v_act.duration_minutes * 60)::double precision);
      v_left := greatest(0, least(1, extract(epoch from (v_s.busy_until - now())) / extract(epoch from v_total)));
      update public.player_state set
        energy = greatest(0, energy - floor(greatest(v_act.energy_delta, 0) * v_left)::int),
        health = greatest(0, health - floor(greatest(v_act.health_delta, 0) * v_left)::int),
        happiness = greatest(0, happiness - floor(greatest(v_act.happiness_delta, 0) * v_left)::int)
      where player_id = v_me;
    end if;
  end if;

  update public.player_state set busy_until = null, busy_activity = null, updated_at = now()
  where player_id = v_me;

  if v_pay is not null then
    perform public.pay_job_shifts(v_me);
  end if;

  return public.game_dynamic(v_me) || jsonb_build_object('stopped', v_slug, 'paid_kobo', v_pay);
end $$;

revoke all on function public.stop_activity(uuid) from public, anon, authenticated;
grant execute on function public.stop_activity(uuid) to service_role;
