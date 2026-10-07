-- CAMPUS LIFE: Stage 7A - academics
-- 10 universities, courses per level and semester, real-time lectures, attendance,
-- study, semester exams, results, GPA/CGPA, promotion, strikes, private-university curfew.
-- Safe to run more than once.

-- =====================================================
-- Seven more universities (fictional), each with its own feel
-- =====================================================
insert into public.universities
  (slug, name, short_name, type, tagline, description, primary_color, secondary_color,
   difficulty, reputation, tuition_per_semester_kobo, party_level, hustle_level, student_population)
values
  ('riverbend-tech', 'Federal University of Technology, Riverbend', 'FUTR', 'federal',
   'Build it, test it, ship it.',
   'A serious federal tech school beside a slow brown river. Labs run late, the generator runs later, and graduates are hired before the convocation photos are printed. Science, engineering and management only.',
   '#0c4a6e', '#f59e0b', 9, 80, 1300000, 4, 6, 26000),
  ('lagoon-city', 'Lagoon City University', 'LCU', 'federal',
   'Big city, bigger dreams.',
   'A crowded federal campus wrapped around a busy lagoon. Lecture halls are packed, the traffic outside is legendary, and there is always a show, a protest or a side hustle somewhere on campus.',
   '#7f1d1d', '#fde047', 8, 85, 1250000, 8, 9, 41000),
  ('northgate-state', 'Northgate State University', 'NGSU', 'state',
   'Calm days, cold harmattan nights.',
   'A wide, quiet state campus where the dust blows in every December. Lecturers know students by name, rent is cheap, and evenings belong to suya spots and long conversations.',
   '#065f46', '#f97316', 6, 60, 3200000, 5, 6, 18000),
  ('palmgrove-state', 'Palmgrove State University', 'PGSU', 'state',
   'Where the palm wine flows on Fridays.',
   'A green state campus surrounded by palm trees and loud weekend parties. Easygoing about many things, strict about exams.',
   '#14532d', '#a3e635', 5, 58, 3000000, 8, 7, 20000),
  ('lighthouse', 'Lighthouse University', 'LHU', 'private',
   'Discipline today, distinction tomorrow.',
   'A strict private university with small classes, a dress code and a firm curfew. Parents love it. Students complain about it and then graduate with good grades.',
   '#1e3a8a', '#e5e7eb', 7, 72, 8500000, 3, 4, 7000),
  ('meridian-business', 'Meridian University of Business', 'MUB', 'private',
   'Every idea is a business plan.',
   'A small private campus where everyone is pitching something. Strong in management, economics and media, with an incubator in the old library.',
   '#312e81', '#fbbf24', 5, 66, 7800000, 6, 9, 5000),
  ('kingsway', 'Kingsway University', 'KWU', 'private',
   'Old money, new money, all money.',
   'The most expensive campus in the game. Big cars at the gate, bigger parties on the weekend, and a reputation that opens doors if your grades can keep up.',
   '#831843', '#fcd34d', 4, 64, 11000000, 9, 6, 4500)
on conflict (slug) do nothing;

-- Faculties, departments and courses for any university that does not have them yet.
-- Specialist universities only offer some faculties.
with templates (faculty, department, course, code, years, base_cutoff) as (
  values
    ('Faculty of Science', 'Computer Science', 'B.Sc. Computer Science', 'CSC', 4, 65),
    ('Faculty of Science', 'Mathematics', 'B.Sc. Mathematics', 'MTH', 4, 58),
    ('Faculty of Science', 'Microbiology', 'B.Sc. Microbiology', 'MCB', 4, 56),
    ('Faculty of Engineering', 'Electrical Engineering', 'B.Eng. Electrical Engineering', 'EEE', 5, 68),
    ('Faculty of Engineering', 'Mechanical Engineering', 'B.Eng. Mechanical Engineering', 'MEE', 5, 66),
    ('Faculty of Engineering', 'Civil Engineering', 'B.Eng. Civil Engineering', 'CVE', 5, 64),
    ('Faculty of Health Sciences', 'Medicine and Surgery', 'MBBS Medicine and Surgery', 'MED', 6, 80),
    ('Faculty of Health Sciences', 'Pharmacy', 'B.Pharm Pharmacy', 'PHM', 5, 72),
    ('Faculty of Health Sciences', 'Nursing Science', 'B.NSc Nursing Science', 'NSC', 5, 66),
    ('Faculty of Social Sciences', 'Economics', 'B.Sc. Economics', 'ECO', 4, 60),
    ('Faculty of Social Sciences', 'Mass Communication', 'B.Sc. Mass Communication', 'MAC', 4, 62),
    ('Faculty of Social Sciences', 'Political Science', 'B.Sc. Political Science', 'POL', 4, 54),
    ('Faculty of Arts', 'English and Literary Studies', 'B.A. English and Literary Studies', 'ENG', 4, 52),
    ('Faculty of Arts', 'Theatre and Creative Arts', 'B.A. Theatre and Creative Arts', 'TCA', 4, 50),
    ('Faculty of Arts', 'History and International Studies', 'B.A. History and International Studies', 'HIS', 4, 50),
    ('Faculty of Law', 'Law', 'LL.B. Law', 'LAW', 5, 74),
    ('Faculty of Management Sciences', 'Accounting', 'B.Sc. Accounting', 'ACC', 4, 60),
    ('Faculty of Management Sciences', 'Business Administration', 'B.Sc. Business Administration', 'BUS', 4, 56)
),
offers (slug, faculties) as (
  values
    ('riverbend-tech', array['Faculty of Science', 'Faculty of Engineering', 'Faculty of Management Sciences']),
    ('meridian-business', array['Faculty of Management Sciences', 'Faculty of Social Sciences', 'Faculty of Arts', 'Faculty of Science']),
    ('palmgrove-state', array['Faculty of Science', 'Faculty of Engineering', 'Faculty of Health Sciences',
                              'Faculty of Social Sciences', 'Faculty of Arts', 'Faculty of Management Sciences'])
),
new_unis as (
  select u.* from public.universities u
  where not exists (select 1 from public.faculties f where f.university_id = u.id)
),
fac as (
  insert into public.faculties (university_id, name)
  select u.id, f.faculty
  from new_unis u
  cross join (select distinct faculty from templates) f
  left join offers o on o.slug = u.slug
  where o.slug is null or f.faculty = any (o.faculties)
  returning id, university_id, name
),
dep as (
  insert into public.departments (faculty_id, name)
  select fac.id, t.department
  from templates t join fac on fac.name = t.faculty
  returning id, faculty_id, name
)
insert into public.courses (department_id, name, code, duration_years, cutoff_score)
select dep.id, t.course, t.code, t.years,
  greatest(30, least(95, t.base_cutoff + case u.type when 'federal' then 8 when 'private' then -8 else 0 end))
from dep
join fac on fac.id = dep.faculty_id
join public.universities u on u.id = fac.university_id
join templates t on t.department = dep.name and t.faculty = fac.name;

-- Campus locations for new universities (same layout family as the first three).
with t (name, kind, descr, x, y, billboard) as (
  values
    ('Hostel Area', 'hostel', 'Where the late-night gist happens and the generator never rests.', 15, 70, false),
    ('Faculty Block', 'faculty', 'Lecture halls, notice boards and the steps where coursemates plot.', 50, 30, false),
    ('Library', 'library', 'Quiet corners, cold air-conditioning and a seat nobody wants to give up.', 75, 25, false),
    ('Cafeteria', 'cafeteria', 'Steaming pots, long queues and the best jollof depends on who you ask.', 40, 60, false),
    ('Market Gate', 'market', 'Hawkers, street food and a thousand small hustles at the main gate.', 85, 75, true),
    ('Sports Field', 'sports', 'Evening football, morning runs and the loudest cheering on campus.', 20, 25, true),
    ('Club House', 'clubhouse', 'Music, lights and the place everybody pretends not to be seen.', 62, 52, true),
    ('Health Centre', 'health', 'Small, busy and always smelling of disinfectant.', 45, 85, false)
)
insert into public.locations (university_id, slug, name, kind, description, map_x, map_y, has_billboard)
select u.id, lower(replace(t.name, ' ', '-')), t.name, t.kind, t.descr,
  case u.type when 'state' then 100 - t.x else t.x end,
  case u.type when 'private' then 100 - t.y else t.y end,
  t.billboard
from public.universities u cross join t
where not exists (select 1 from public.locations l where l.university_id = u.id);

insert into public.university_accommodations (university_id, accommodation_slug, rent_per_semester_kobo)
select u.id, a.slug,
  a.base * (case u.type when 'state' then 13 when 'private' then 20 else 10 end) / 10
from public.universities u
cross join (values
  ('hostel-shared', 600000::bigint), ('shared-apartment', 1500000::bigint),
  ('private-room', 3000000::bigint), ('off-campus', 2000000::bigint)) as a (slug, base)
on conflict do nothing;

-- =====================================================
-- The academic calendar (real Nigerian time)
-- One cycle = 21 days of lectures + 7 days of exams + 7 days of holiday.
-- =====================================================
insert into public.app_config (key, value) values
  ('academic_epoch', '"2026-10-05T00:00:00+01:00"'),
  ('lecture_days', '21'),
  ('exam_days', '7'),
  ('holiday_days', '7'),
  ('curfew_fine_kobo', '200000')
on conflict (key) do nothing;

create or replace function public.semester_bounds(p_idx int)
returns table (idx int, sem_start timestamptz, lectures_end timestamptz, exams_end timestamptz, holiday_end timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_epoch timestamptz; v_l int; v_e int; v_h int;
begin
  v_epoch := coalesce((select (value #>> '{}')::timestamptz from public.app_config where key = 'academic_epoch'),
                      '2026-10-05T00:00:00+01:00'::timestamptz);
  v_l := public.config_number('lecture_days', 21);
  v_e := public.config_number('exam_days', 7);
  v_h := public.config_number('holiday_days', 7);
  idx := p_idx;
  sem_start := v_epoch + make_interval(days => p_idx * (v_l + v_e + v_h));
  lectures_end := sem_start + make_interval(days => v_l);
  exams_end := lectures_end + make_interval(days => v_e);
  holiday_end := exams_end + make_interval(days => v_h);
  return next;
end $$;

create or replace function public.academic_now()
returns table (idx int, phase text, sem_start timestamptz, lectures_end timestamptz,
               exams_end timestamptz, holiday_end timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare v_epoch timestamptz; v_cycle numeric; v_idx int; b record;
begin
  v_epoch := coalesce((select (value #>> '{}')::timestamptz from public.app_config where key = 'academic_epoch'),
                      '2026-10-05T00:00:00+01:00'::timestamptz);
  v_cycle := public.config_number('lecture_days', 21) + public.config_number('exam_days', 7)
           + public.config_number('holiday_days', 7);
  v_idx := floor(extract(epoch from (now() - v_epoch)) / 86400 / v_cycle)::int;
  select * into b from public.semester_bounds(v_idx);
  idx := v_idx;
  sem_start := b.sem_start; lectures_end := b.lectures_end;
  exams_end := b.exams_end; holiday_end := b.holiday_end;
  phase := case when now() < b.sem_start then 'holiday'
                when now() < b.lectures_end then 'lectures'
                when now() < b.exams_end then 'exams'
                else 'holiday' end;
  return next;
end $$;

-- =====================================================
-- Courses (modules) per programme, level and semester, with two weekly lecture slots
-- =====================================================
create table if not exists public.modules (
  code text primary key check (code ~ '^[A-Z]{3}[0-9]{3}$'),
  programme_code text not null check (programme_code ~ '^[A-Z]{3}$'),
  level smallint not null check (level between 1 and 6),
  semester smallint not null check (semester in (1, 2)),
  title text not null check (length(title) between 3 and 80),
  units smallint not null check (units between 1 and 6),
  slot1_dow smallint not null check (slot1_dow between 1 and 7),
  slot1_hour smallint not null check (slot1_hour between 0 and 23),
  slot2_dow smallint not null check (slot2_dow between 1 and 7),
  slot2_hour smallint not null check (slot2_hour between 0 and 23)
);
create index if not exists modules_programme_idx on public.modules (programme_code, level, semester);
alter table public.modules enable row level security;
revoke all on public.modules from anon, authenticated;

with programmes (code, dept, years) as (
  values ('CSC', 'Computer Science', 4), ('MTH', 'Mathematics', 4), ('MCB', 'Microbiology', 4),
         ('EEE', 'Electrical Engineering', 5), ('MEE', 'Mechanical Engineering', 5),
         ('CVE', 'Civil Engineering', 5), ('MED', 'Medicine', 6), ('PHM', 'Pharmacy', 5),
         ('NSC', 'Nursing', 5), ('ECO', 'Economics', 4), ('MAC', 'Mass Communication', 4),
         ('POL', 'Political Science', 4), ('ENG', 'Literature in English', 4),
         ('TCA', 'Theatre Arts', 4), ('HIS', 'History', 4), ('LAW', 'Law', 5),
         ('ACC', 'Accounting', 4), ('BUS', 'Business Administration', 4)
),
plan as (
  select p.code as programme, p.dept, p.years, lvl, sem, k
  from programmes p
  cross join generate_series(1, 6) lvl
  cross join generate_series(1, 2) sem
  cross join generate_series(1, 2) k
  where lvl <= p.years
),
named as (
  select programme || lvl || sem || k as code, programme, lvl, sem,
    case
      when lvl = 1 and k = 1 then 'Introduction to ' || dept || case sem when 1 then ' I' else ' II' end
      when lvl = 1 then 'Basic ' || dept || ' Practice ' || case sem when 1 then 'I' else 'II' end
      when lvl = 2 and k = 1 then 'Principles of ' || dept || case sem when 1 then ' I' else ' II' end
      when lvl = 2 then dept || ' Methods ' || case sem when 1 then 'I' else 'II' end
      when lvl = 3 and k = 1 then 'Advanced ' || dept || case sem when 1 then ' I' else ' II' end
      when lvl = 3 then 'Applied ' || dept || case sem when 1 then ' I' else ' II' end
      when lvl = years and sem = 2 and k = 2 then 'Final Year Project'
      when lvl = years and k = 1 then 'Contemporary Issues in ' || dept
      when lvl = years then 'Research Methods in ' || dept
      else 'Professional Practice in ' || dept || case k when 1 then ' I' else ' II' end
    end as title,
    case when lvl = years and sem = 2 and k = 2 then 6 else 3 end as units,
    abs(hashtext(programme || lvl || sem || k)) as h
  from plan
),
gst (code, lvl, sem, title) as (
  values ('GST111', 1, 1, 'Use of English'), ('GST121', 1, 2, 'Nigerian Peoples and Culture'),
         ('GST211', 2, 1, 'Entrepreneurship'), ('GST221', 2, 2, 'Peace and Conflict Resolution')
),
all_modules as (
  select code, programme, lvl, sem, title, units, h from named
  union all
  select code, 'GST', lvl, sem, title, 2, abs(hashtext(code)) from gst
)
insert into public.modules
  (code, programme_code, level, semester, title, units, slot1_dow, slot1_hour, slot2_dow, slot2_hour)
select code, programme, lvl, sem, title, units,
  1 + (h % 6),                         -- Monday..Saturday
  8 + ((h / 7) % 12),                  -- 8 AM..7 PM
  1 + ((h % 6) + 3) % 6,               -- three days later in the week
  9 + ((h / 97) % 12)                  -- 9 AM..8 PM
from all_modules
on conflict (code) do nothing;

-- When the lectures of a slot start, between two moments (Lagos time).
create or replace function public.lecture_starts(p_dow smallint, p_hour smallint, p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql stable security definer set search_path = ''
as $$
  select s from (
    select ((d::date + make_time(p_hour, 0, 0)) at time zone 'Africa/Lagos') as s
    from generate_series((p_from at time zone 'Africa/Lagos')::date,
                         (p_to at time zone 'Africa/Lagos')::date, interval '1 day') d
    where extract(isodow from d) = p_dow
  ) x
  where s >= p_from and s <= p_to
$$;

-- =====================================================
-- Strikes (federal and state universities)
-- =====================================================
create table if not exists public.strikes (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities (id) on delete cascade,  -- one campus, or
  university_type public.university_type,                                     -- every campus of a type, or
  starts_at timestamptz not null,                                             -- (both empty) everyone
  ends_at timestamptz not null,
  reason text not null check (length(reason) between 3 and 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.strikes enable row level security;
revoke all on public.strikes from anon, authenticated;

create or replace function public.strike_at(p_uni uuid, p_at timestamptz)
returns text
language sql stable security definer set search_path = ''
as $$
  select s.reason from public.strikes s
  join public.universities u on u.id = p_uni
  where p_at >= s.starts_at and p_at < s.ends_at
    and (s.university_id = p_uni or s.university_type = u.type
         or (s.university_id is null and s.university_type is null))
  order by s.starts_at desc limit 1
$$;

-- Lectures that actually took place (strike days do not count against attendance).
create or replace function public.lectures_held(p_code text, p_uni uuid, p_from timestamptz, p_to timestamptz)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.modules m
  cross join lateral (
    select s from public.lecture_starts(m.slot1_dow, m.slot1_hour, p_from, p_to) s
    union all
    select s from public.lecture_starts(m.slot2_dow, m.slot2_hour, p_from, p_to) s
  ) x
  where m.code = p_code and public.strike_at(p_uni, x.s) is null
$$;

-- =====================================================
-- Registrations, course records, attendance, CGPA
-- =====================================================
alter table public.enrollments add column if not exists cgpa numeric(4, 2);
alter table public.enrollments add column if not exists total_units integer not null default 0;
alter table public.enrollments add column if not exists total_points integer not null default 0;

create table if not exists public.semester_registrations (
  player_id uuid not null references public.players (id) on delete cascade,
  semester_idx integer not null,
  level_year smallint not null,
  semester_no smallint not null check (semester_no in (1, 2)),
  university_id uuid not null references public.universities (id),
  programme_code text not null,
  status text not null default 'active' check (status in ('active', 'graded')),
  gpa numeric(3, 2),
  units integer,
  registered_at timestamptz not null default now(),
  graded_at timestamptz,
  primary key (player_id, semester_idx)
);

create table if not exists public.module_records (
  player_id uuid not null,
  semester_idx integer not null,
  module_code text not null references public.modules (code),
  study_points smallint not null default 0 check (study_points between 0 and 10),
  exam_written_at timestamptz,
  exam_energy smallint,
  exam_health smallint,
  ca smallint,
  exam smallint,
  score smallint,
  grade text check (grade in ('A', 'B', 'C', 'D', 'E', 'F')),
  grade_point smallint,
  primary key (player_id, semester_idx, module_code),
  foreign key (player_id, semester_idx)
    references public.semester_registrations (player_id, semester_idx) on delete cascade
);

create table if not exists public.lecture_attendance (
  player_id uuid not null references public.players (id) on delete cascade,
  module_code text not null references public.modules (code),
  lecture_start timestamptz not null,
  semester_idx integer not null,
  attended_at timestamptz not null default now(),
  primary key (player_id, module_code, lecture_start)
);
create index if not exists lecture_attendance_sem_idx
  on public.lecture_attendance (player_id, semester_idx, module_code);

alter table public.semester_registrations enable row level security;
alter table public.module_records enable row level security;
alter table public.lecture_attendance enable row level security;
revoke all on public.semester_registrations, public.module_records, public.lecture_attendance
  from anon, authenticated;

-- Works out the results of a finished semester (once).
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

-- Keeps a player's academics up to date: grades finished semesters, registers for the current one.
create or replace function public.sync_academics(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_now record; v_reg record; v_enr record; b record;
begin
  select * into v_now from public.academic_now();

  for v_reg in
    select semester_idx from public.semester_registrations
    where player_id = p_player and status = 'active' order by semester_idx
  loop
    select * into b from public.semester_bounds(v_reg.semester_idx);
    if b.exams_end <= now() then
      perform public.grade_semester(p_player, v_reg.semester_idx);
    end if;
  end loop;

  -- Register for this semester while lectures are running (late joiners count from today).
  if v_now.phase = 'lectures' and v_now.idx >= 0
     and not exists (select 1 from public.semester_registrations
                     where player_id = p_player and semester_idx = v_now.idx) then
    select e.level_year, e.university_id, c.code as programme into v_enr
    from public.enrollments e join public.courses c on c.id = e.course_id
    where e.player_id = p_player and e.status = 'active';
    if found then
      insert into public.semester_registrations
        (player_id, semester_idx, level_year, semester_no, university_id, programme_code)
      values (p_player, v_now.idx, v_enr.level_year, (v_now.idx % 2) + 1, v_enr.university_id, v_enr.programme)
      on conflict do nothing;

      insert into public.module_records (player_id, semester_idx, module_code)
      select p_player, v_now.idx, m.code from public.modules m
      where m.level = v_enr.level_year and m.semester = (v_now.idx % 2) + 1
        and m.programme_code in (v_enr.programme, 'GST')
      on conflict do nothing;
    end if;
  end if;
end $$;

-- The lecture of this course that is on right now (2-hour window), if any.
create or replace function public.live_lecture(p_code text)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select max(x.s) from public.modules m
  cross join lateral (
    select s from public.lecture_starts(m.slot1_dow, m.slot1_hour, now() - interval '2 hours', now()) s
    union all
    select s from public.lecture_starts(m.slot2_dow, m.slot2_hour, now() - interval '2 hours', now()) s
  ) x
  where m.code = p_code
$$;

-- =====================================================
-- What the Academics screen shows
-- =====================================================
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

-- =====================================================
-- Attending, studying, writing exams
-- =====================================================
create or replace function public.attend_lecture(p_user_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_now record; v_kind text; v_start timestamptz;
        v_uni uuid; v_rows int;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('academic:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_player);
  perform public.sync_academics(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  select kind, university_id into v_kind, v_uni from public.locations where id = v_s.location_id;
  if v_kind <> 'faculty' then raise exception 'go to the faculty'; end if;

  select * into v_now from public.academic_now();
  if v_now.phase <> 'lectures' then raise exception 'no lectures now'; end if;
  if not exists (select 1 from public.module_records
                 where player_id = v_player and semester_idx = v_now.idx and module_code = p_code) then
    raise exception 'not your course';
  end if;

  v_start := public.live_lecture(p_code);
  if v_start is null then raise exception 'no lecture now'; end if;
  if public.strike_at(v_uni, v_start) is not null then raise exception 'strike'; end if;
  if v_s.energy < 5 then raise exception 'too tired'; end if;

  insert into public.lecture_attendance (player_id, module_code, lecture_start, semester_idx)
  values (v_player, p_code, v_start, v_now.idx)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'already attended'; end if;

  update public.player_state set
    energy = energy - 5,
    busy_until = now() + interval '5 minutes',
    busy_activity = 'lecture:' || p_code,
    updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

create or replace function public.study_module(p_user_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_now record; v_kind text; v_rec public.module_records%rowtype;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('academic:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_player);
  perform public.sync_academics(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind not in ('library', 'hostel') then raise exception 'study at the library or hostel'; end if;

  select * into v_now from public.academic_now();
  if v_now.phase = 'holiday' then raise exception 'holiday'; end if;

  select * into v_rec from public.module_records
  where player_id = v_player and semester_idx = v_now.idx and module_code = p_code for update;
  if not found then raise exception 'not your course'; end if;
  if v_rec.exam_written_at is not null then raise exception 'exam already written'; end if;
  if v_rec.study_points >= 10 then raise exception 'fully prepared'; end if;
  if v_s.energy < 6 then raise exception 'too tired'; end if;

  update public.module_records set study_points = study_points + 1
  where player_id = v_player and semester_idx = v_now.idx and module_code = p_code;

  update public.player_state set
    energy = energy - 6,
    busy_until = now() + case when v_kind = 'library' then interval '3 minutes' else interval '4 minutes' end,
    busy_activity = 'study:' || p_code,
    updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

create or replace function public.write_exam(p_user_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_now record; v_kind text; v_rec public.module_records%rowtype;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('academic:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  perform public.sync_player_state(v_player);
  perform public.sync_academics(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;
  select kind into v_kind from public.locations where id = v_s.location_id;
  if v_kind <> 'faculty' then raise exception 'go to the faculty'; end if;

  select * into v_now from public.academic_now();
  if v_now.phase <> 'exams' then raise exception 'not exam week'; end if;

  select * into v_rec from public.module_records
  where player_id = v_player and semester_idx = v_now.idx and module_code = p_code for update;
  if not found then raise exception 'not your course'; end if;
  if v_rec.exam_written_at is not null then raise exception 'exam already written'; end if;
  if v_s.energy < 8 then raise exception 'too tired'; end if;

  -- How you felt when you sat the exam counts towards the score.
  update public.module_records set
    exam_written_at = now(), exam_energy = v_s.energy, exam_health = v_s.health
  where player_id = v_player and semester_idx = v_now.idx and module_code = p_code;

  update public.player_state set
    energy = energy - 8,
    busy_until = now() + interval '5 minutes',
    busy_activity = 'exam:' || p_code,
    updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

-- Studying together in the library also helps both students prepare.
-- (Adds one study point to a random course each player is still preparing for.)
create or replace function public.study_together_bonus(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_now record;
begin
  select * into v_now from public.academic_now();
  if v_now.phase = 'holiday' then return; end if;
  update public.module_records set study_points = study_points + 1
  where (player_id, semester_idx, module_code) = (
    select player_id, semester_idx, module_code from public.module_records
    where player_id = p_player and semester_idx = v_now.idx
      and exam_written_at is null and study_points < 10
    order by random() limit 1);
end $$;

create or replace function public.place_event_effects()
returns trigger
language plpgsql security definer set search_path = ''
as $fx$
begin
  if new.kind = 'study_together' then
    perform public.study_together_bonus(new.actor_id);
    if new.target_id is not null then perform public.study_together_bonus(new.target_id); end if;
  end if;
  return new;
end $fx$;

drop trigger if exists place_events_effects on public.place_events;
create trigger place_events_effects
  after insert on public.place_events
  for each row execute function public.place_event_effects();

-- =====================================================
-- Private universities: leaving the hostel after curfew (11 PM to 5 AM) costs a gate fine.
-- =====================================================
create or replace function public.travel_to(p_user_id uuid, p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_uni uuid; v_type public.university_type; v_s public.player_state%rowtype;
  v_from public.locations%rowtype; v_to public.locations%rowtype; v_cost int;
  v_hour int; v_fine bigint; v_fined boolean := false;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('travel:u:' || p_user_id, 60, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select e.university_id, u.type into v_uni, v_type
  from public.enrollments e join public.universities u on u.id = e.university_id
  where e.player_id = v_player and e.status = 'active';

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is not null then raise exception 'asleep'; end if;
  if v_s.busy_until is not null and v_s.busy_until > now() then raise exception 'busy'; end if;

  select * into v_to from public.locations where id = p_location_id and university_id = v_uni;
  if not found then raise exception 'unknown location'; end if;
  if v_to.id = v_s.location_id then return public.game_dynamic(v_player); end if;

  select * into v_from from public.locations where id = v_s.location_id;
  v_cost := greatest(1, ceil(sqrt(power(v_from.map_x - v_to.map_x, 2)
                                 + power(v_from.map_y - v_to.map_y, 2)) / 25.0))::int;
  if v_s.energy < v_cost then raise exception 'too tired'; end if;

  v_hour := extract(hour from (now() at time zone 'Africa/Lagos'))::int;
  if v_type = 'private' and v_from.kind = 'hostel' and (v_hour >= 23 or v_hour < 5) then
    v_fine := public.config_number('curfew_fine_kobo', 200000)::bigint;
    if not exists (select 1 from public.wallets where player_id = v_player and balance_kobo >= v_fine) then
      raise exception 'curfew';
    end if;
    perform public.wallet_apply(v_player, -v_fine, 'curfew_fine', 'Gate fine: left the hostel after curfew');
    v_fined := true;
  end if;

  update public.player_state set
    location_id = v_to.id, energy = energy - v_cost, updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player) || jsonb_build_object('curfew_fine', v_fined);
end $$;

-- =====================================================
-- Who may call what: only our trusted server
-- =====================================================
revoke all on function public.semester_bounds(int) from public, anon, authenticated;
revoke all on function public.academic_now() from public, anon, authenticated;
revoke all on function public.lecture_starts(smallint, smallint, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.strike_at(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.lectures_held(text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.grade_semester(uuid, int) from public, anon, authenticated;
revoke all on function public.sync_academics(uuid) from public, anon, authenticated;
revoke all on function public.live_lecture(text) from public, anon, authenticated;
revoke all on function public.study_together_bonus(uuid) from public, anon, authenticated;
revoke all on function public.get_academics(uuid) from public, anon, authenticated;
revoke all on function public.attend_lecture(uuid, text) from public, anon, authenticated;
revoke all on function public.study_module(uuid, text) from public, anon, authenticated;
revoke all on function public.write_exam(uuid, text) from public, anon, authenticated;
revoke all on function public.travel_to(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_academics(uuid) to service_role;
grant execute on function public.attend_lecture(uuid, text) to service_role;
grant execute on function public.study_module(uuid, text) to service_role;
grant execute on function public.write_exam(uuid, text) to service_role;
grant execute on function public.travel_to(uuid, uuid) to service_role;
