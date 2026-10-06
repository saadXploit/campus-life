-- CAMPUS LIFE: Stage 2A - starting universities and courses (fictional)
-- Run ONCE. Fees are placeholders until the Stage 5 economy balancing.

insert into public.universities
  (slug, name, short_name, type, tagline, description, primary_color, secondary_color,
   difficulty, reputation, tuition_per_semester_kobo, party_level, hustle_level, student_population)
values
  ('savannah-plateau',
   'Federal University of Savannah Plateau', 'FUSP', 'federal',
   'Where the whole country shows up.',
   'A vast national campus on the savannah plateau. Fees are low and the name carries weight, but thousands compete for every seat. Lecture halls overflow, the market behind the main gate never sleeps, and everyone has a hustle.',
   '#14532d', '#facc15', 8, 82, 1200000, 5, 7, 38000),
  ('hilltop-state',
   'Hilltop State University', 'HSU', 'state',
   'Close-knit, loud on match day.',
   'A state university on the hills above a small town. Everyone knows everyone, the football pitch is the heart of the campus, and rent is kind. Quiet during the week, wild when the home team plays.',
   '#1e3a8a', '#f97316', 6, 65, 3500000, 7, 6, 22000),
  ('crestfield',
   'Crestfield University', 'CFU', 'private',
   'Polished. Pricey. Plenty of connections.',
   'A private university with manicured lawns, small classes and a long list of well-connected parents. Getting in is easier, staying in is expensive. Parties are glamorous, and reputation is the real currency.',
   '#581c87', '#fbbf24', 5, 74, 9000000, 8, 5, 6500);

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
fac as (
  insert into public.faculties (university_id, name)
  select u.id, f.faculty
  from public.universities u
  cross join (select distinct faculty from templates) f
  returning id, university_id, name
),
dep as (
  insert into public.departments (faculty_id, name)
  select fac.id, t.department
  from templates t
  join fac on fac.name = t.faculty
  returning id, faculty_id, name
)
insert into public.courses (department_id, name, code, duration_years, cutoff_score)
select
  dep.id, t.course, t.code, t.years,
  greatest(30, least(95, t.base_cutoff + case u.type
    when 'federal' then 8
    when 'private' then -8
    else 0 end))
from dep
join fac on fac.id = dep.faculty_id
join public.universities u on u.id = fac.university_id
join templates t on t.department = dep.name and t.faculty = fac.name;