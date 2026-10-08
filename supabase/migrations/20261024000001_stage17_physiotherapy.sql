-- CAMPUS LIFE: Stage 17 - Physiotherapy
-- DPT Physiotherapy (Doctor of Physiotherapy, 6 years) in the Faculty of Health Sciences,
-- at every university that has one. If an earlier draft placed "B.Sc. Physiotherapy"
-- under the Faculty of Science, this moves and corrects it. Safe to run more than once.

-- 1. A Physiotherapy department in each Faculty of Health Sciences.
insert into public.departments (faculty_id, name)
select f.id, 'Physiotherapy'
from public.faculties f
where f.name = 'Faculty of Health Sciences'
on conflict (faculty_id, name) do nothing;

-- 2. Earlier draft: move the course from Science to Health Sciences and correct it.
update public.courses c
set department_id = hd.id, name = 'DPT Physiotherapy', duration_years = 6, cutoff_score = 70
from public.departments sd
join public.faculties sf on sf.id = sd.faculty_id and sf.name = 'Faculty of Science'
join public.faculties hf on hf.university_id = sf.university_id and hf.name = 'Faculty of Health Sciences'
join public.departments hd on hd.faculty_id = hf.id and hd.name = 'Physiotherapy'
where c.department_id = sd.id and sd.name = 'Physiotherapy' and c.code = 'PTH'
  and not exists (select 1 from public.courses x where x.department_id = hd.id and x.name = 'DPT Physiotherapy');

--    Universities without a Faculty of Health Sciences do not offer it (unless someone
--    has already applied or enrolled, in which case it is kept for them).
delete from public.courses c
using public.departments sd, public.faculties sf
where c.department_id = sd.id and sd.faculty_id = sf.id
  and sf.name = 'Faculty of Science' and sd.name = 'Physiotherapy' and c.code = 'PTH'
  and not exists (select 1 from public.enrollments e where e.course_id = c.id)
  and not exists (select 1 from public.application_choices a where a.course_id = c.id)
  and not exists (select 1 from public.application_results r where r.course_id = c.id);

delete from public.departments d
using public.faculties f
where d.faculty_id = f.id and f.name = 'Faculty of Science' and d.name = 'Physiotherapy'
  and not exists (select 1 from public.courses c where c.department_id = d.id);

-- 3. The course itself.
insert into public.courses (department_id, name, code, duration_years, cutoff_score)
select d.id, 'DPT Physiotherapy', 'PTH', 6, 70
from public.departments d
join public.faculties f on f.id = d.faculty_id
where f.name = 'Faculty of Health Sciences' and d.name = 'Physiotherapy'
on conflict (department_id, name) do nothing;

-- 4. Its courses: two per semester for 6 years, each with two lecture times.
with plan (lvl, sem, k, title, units) as (
  values
    (1, 1, 1, 'Introduction to Physiotherapy', 3),
    (1, 1, 2, 'General Biology and Chemistry for Health Sciences', 3),
    (1, 2, 1, 'Introductory Physics for Physiotherapy', 3),
    (1, 2, 2, 'Basic Biochemistry for Physiotherapy', 3),
    (2, 1, 1, 'Human Anatomy I', 3),
    (2, 1, 2, 'Human Physiology I', 3),
    (2, 2, 1, 'Human Anatomy II', 3),
    (2, 2, 2, 'Human Physiology II', 3),
    (3, 1, 1, 'Kinesiology and Biomechanics', 3),
    (3, 1, 2, 'Exercise Therapy I', 3),
    (3, 2, 1, 'Electrotherapy', 3),
    (3, 2, 2, 'Pathology for Physiotherapists', 3),
    (4, 1, 1, 'Exercise Therapy II', 3),
    (4, 1, 2, 'Musculoskeletal Physiotherapy', 3),
    (4, 2, 1, 'Neurological Physiotherapy', 3),
    (4, 2, 2, 'Cardiopulmonary Physiotherapy', 3),
    (5, 1, 1, 'Paediatric Physiotherapy', 3),
    (5, 1, 2, 'Sports Physiotherapy', 3),
    (5, 2, 1, 'Orthopaedic and Manual Therapy', 3),
    (5, 2, 2, 'Research Methods in Physiotherapy', 3),
    (6, 1, 1, 'Clinical Practice in Physiotherapy I', 3),
    (6, 1, 2, 'Community and Geriatric Physiotherapy', 3),
    (6, 2, 1, 'Clinical Practice in Physiotherapy II', 3),
    (6, 2, 2, 'Final Year Project', 6)
),
named as (
  select 'PTH' || lvl || sem || k as code, lvl, sem, title, units,
         abs(hashtext('PTH' || lvl || sem || k)) as h
  from plan
)
insert into public.modules
  (code, programme_code, level, semester, title, units, slot1_dow, slot1_hour, slot2_dow, slot2_hour)
select code, 'PTH', lvl, sem, title, units,
  1 + (h % 6),                         -- Monday..Saturday (ignored while lectures are daily)
  8 + ((h / 7) % 12),                  -- 8 AM..7 PM
  1 + ((h % 6) + 3) % 6,
  9 + ((h / 97) % 12)                  -- 9 AM..8 PM
from named
on conflict (code) do update set title = excluded.title, units = excluded.units;
