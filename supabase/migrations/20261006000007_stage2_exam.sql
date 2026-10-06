-- CAMPUS LIFE: Stage 2E - screening exam

alter table public.applications add column result_ready_at timestamptz;

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('maths', 'english', 'logic', 'general')),
  prompt text not null check (length(prompt) between 5 and 300),
  options text[] not null check (array_length(options, 1) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  is_active boolean not null default true
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score smallint check (score between 0 and 10)
);

create table public.exam_attempt_questions (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  position smallint not null check (position between 1 and 10),
  question_id uuid not null references public.exam_questions (id),
  option_order smallint[] not null,
  chosen_index smallint check (chosen_index between 0 and 3),
  primary key (attempt_id, position)
);

-- Players can never read these tables. Only our trusted server can.
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_questions enable row level security;
revoke all on public.exam_questions, public.exam_attempts, public.exam_attempt_questions
  from anon, authenticated;

-- Starts the exam, or returns the existing one (no re-rolls).
create function public.start_or_resume_exam(p_user_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_app public.applications%rowtype; v_attempt uuid; v_n int;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select * into v_app from public.applications
  where player_id = v_player and status <> 'decided' for update;
  if not found then raise exception 'no open application'; end if;
  if v_app.status = 'awaiting_result' then raise exception 'exam already submitted'; end if;
  if now() < v_app.exam_opens_at then raise exception 'exam not open yet'; end if;

  select id into v_attempt from public.exam_attempts where application_id = v_app.id;
  if v_attempt is not null then return v_attempt; end if;

  insert into public.exam_attempts (application_id, expires_at)
  values (v_app.id, now() + interval '8 minutes')
  returning id into v_attempt;

  insert into public.exam_attempt_questions (attempt_id, position, question_id, option_order)
  select v_attempt,
         (row_number() over (order by random()))::smallint,
         q.id,
         (select array_agg(i::smallint order by random())
            from generate_series(0, 3) i where q.id is not null)
  from (
    select t.id from (
      select id, category,
             row_number() over (partition by category order by random()) as rn
      from public.exam_questions where is_active
    ) t
    where (t.category = 'maths' and t.rn <= 3)
       or (t.category = 'english' and t.rn <= 3)
       or (t.category = 'logic' and t.rn <= 2)
       or (t.category = 'general' and t.rn <= 2)
  ) q;

  get diagnostics v_n = row_count;
  if v_n <> 10 then raise exception 'not enough exam questions'; end if;

  update public.applications set status = 'exam_in_progress' where id = v_app.id;
  return v_attempt;
end $$;

-- Returns the questions (shuffled options, NO answers) for the owner only.
create function public.get_exam(p_user_id uuid, p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'expires_at', a.expires_at,
    'submitted', a.submitted_at is not null,
    'questions', (
      select jsonb_agg(
        jsonb_build_object(
          'position', aq.position,
          'prompt', q.prompt,
          'options', (
            select jsonb_agg(q.options[t.o + 1] order by t.ord)
            from unnest(aq.option_order) with ordinality as t(o, ord)
          ),
          'chosen', aq.chosen_index
        ) order by aq.position)
      from public.exam_attempt_questions aq
      join public.exam_questions q on q.id = aq.question_id
      where aq.attempt_id = a.id
    )
  ) into v_result
  from public.exam_attempts a
  join public.applications ap on ap.id = a.application_id
  join public.players p on p.id = ap.player_id
  where a.id = p_attempt_id and p.user_id = p_user_id;

  if v_result is null then raise exception 'not your exam'; end if;
  return v_result;
end $$;

create function public.save_exam_answer(
  p_user_id uuid, p_attempt_id uuid, p_position smallint, p_chosen smallint
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_chosen not between 0 and 3 then raise exception 'bad answer'; end if;

  update public.exam_attempt_questions aq
  set chosen_index = p_chosen
  from public.exam_attempts a
  join public.applications ap on ap.id = a.application_id
  join public.players p on p.id = ap.player_id
  where aq.attempt_id = a.id
    and a.id = p_attempt_id
    and p.user_id = p_user_id
    and aq.position = p_position
    and a.submitted_at is null
    and now() <= a.expires_at + interval '5 seconds';

  if not found then raise exception 'cannot save answer'; end if;
end $$;

-- Scores the exam. Safe to call twice. The score is never returned.
create function public.finish_exam(p_user_id uuid, p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_app uuid; v_done timestamptz; v_score int;
begin
  select ap.id, a.submitted_at into v_app, v_done
  from public.exam_attempts a
  join public.applications ap on ap.id = a.application_id
  join public.players p on p.id = ap.player_id
  where a.id = p_attempt_id and p.user_id = p_user_id
  for update of a;

  if v_app is null then raise exception 'not your exam'; end if;
  if v_done is not null then return; end if;

  select count(*) into v_score
  from public.exam_attempt_questions aq
  join public.exam_questions q on q.id = aq.question_id
  where aq.attempt_id = p_attempt_id
    and aq.chosen_index is not null
    and aq.option_order[aq.chosen_index + 1] = q.correct_index;

  update public.exam_attempts
  set submitted_at = now(), score = v_score where id = p_attempt_id;

  update public.applications
  set status = 'awaiting_result', result_ready_at = now() + interval '2 minutes'
  where id = v_app;
end $$;

revoke all on function public.start_or_resume_exam(uuid) from public, anon, authenticated;
revoke all on function public.get_exam(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_exam_answer(uuid, uuid, smallint, smallint) from public, anon, authenticated;
revoke all on function public.finish_exam(uuid, uuid) from public, anon, authenticated;
grant execute on function public.start_or_resume_exam(uuid) to service_role;
grant execute on function public.get_exam(uuid, uuid) to service_role;
grant execute on function public.save_exam_answer(uuid, uuid, smallint, smallint) to service_role;
grant execute on function public.finish_exam(uuid, uuid) to service_role;

-- Question bank (original questions)
insert into public.exam_questions (category, prompt, options, correct_index) values
('maths', 'What is 15% of 200?', array['20','25','30','35'], 2),
('maths', 'If 3x + 5 = 20, what is the value of x?', array['3','4','5','6'], 2),
('maths', 'A bus travels 120 km in 2 hours. At the same speed, how far will it travel in 5 hours?', array['240 km','300 km','360 km','600 km'], 1),
('maths', 'What number comes next? 2, 6, 12, 20, 30, ...', array['40','42','44','36'], 1),
('maths', 'A shirt costs ₦8,000 and is sold at a 25% discount. What is the new price?', array['₦6,000','₦6,500','₦7,000','₦2,000'], 0),
('maths', 'What is the average of 4, 8, 12 and 16?', array['9','10','11','12'], 1),
('maths', 'Which of these fractions is the largest?', array['3/4','5/8','7/10','2/3'], 0),
('maths', 'A rectangle is 12 cm long and 5 cm wide. What is its perimeter?', array['17 cm','34 cm','60 cm','30 cm'], 1),
('english', 'Which word is closest in meaning to "scarce"?', array['Plentiful','Rare','Heavy','Loud'], 1),
('english', 'Which word is the opposite of "generous"?', array['Kind','Selfish','Rich','Quiet'], 1),
('english', 'Which word is spelled correctly?', array['Accomodation','Accommodation','Acommodation','Accommodasion'], 1),
('english', 'Choose the correct word: She ___ to school every day.', array['goes','go','going','gone'], 0),
('english', 'Choose the correct word: Neither of the two boys ___ ready.', array['are','were','is','be'], 2),
('english', 'Choose the correct word: The lecturer was ___ by the brilliant answers.', array['impressed','impress','impressing','impression'], 0),
('english', 'Which word means the same as "diligent"?', array['Lazy','Hardworking','Careless','Slow'], 1),
('logic', 'All lecturers are staff members. Dr. Bello is a lecturer. What follows?', array['Dr. Bello is a staff member','Dr. Bello is not a staff member','Dr. Bello is a student','Nothing can be said'], 0),
('logic', 'Which letter comes next? A, C, E, G, ...', array['H','I','J','K'], 1),
('logic', 'If today is Wednesday, what day will it be 10 days from now?', array['Friday','Saturday','Sunday','Monday'], 1),
('logic', 'Which one does not belong?', array['Mango','Orange','Carrot','Banana'], 2),
('logic', 'Tola is taller than Ade. Ade is taller than Bisi. Who is the shortest?', array['Tola','Ade','Bisi','Cannot tell'], 2),
('logic', 'Five machines make five items in five minutes. How long would 100 machines take to make 100 items?', array['5 minutes','20 minutes','100 minutes','1 minute'], 0),
('logic', 'Book is to reading as fork is to ...', array['Eating','Cooking','Spoon','Kitchen'], 0),
('general', 'What is the capital city of Nigeria?', array['Lagos','Abuja','Kano','Ibadan'], 1),
('general', 'Which gas do plants take in from the air for photosynthesis?', array['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'], 2),
('general', 'How many states does Nigeria have, not counting the Federal Capital Territory?', array['30','36','37','32'], 1),
('general', 'Which planet is known as the Red Planet?', array['Venus','Mars','Jupiter','Saturn'], 1),
('general', 'What is the chemical formula for water?', array['CO2','H2O','O2','NaCl'], 1),
('general', 'Which of these is a renewable source of energy?', array['Coal','Solar power','Diesel','Natural gas'], 1),
('general', 'Which is the largest continent by area?', array['Africa','Europe','Asia','Australia'], 2),
('general', 'What does CPU stand for in a computer?', array['Central Processing Unit','Computer Personal Unit','Central Program Utility','Control Power Unit'], 0);