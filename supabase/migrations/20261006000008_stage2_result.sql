-- CAMPUS LIFE: Stage 2F - results, offers, enrolments

alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('exam_pending','exam_in_progress','awaiting_result','offer_pending','decided'));

create table public.application_results (
  application_id uuid primary key references public.applications (id) on delete cascade,
  outcome text not null check (outcome in ('admitted', 'offer', 'rejected')),
  choice_rank smallint check (choice_rank between 1 and 3),
  university_id uuid references public.universities (id),
  course_id uuid references public.courses (id),
  offer_response text check (offer_response in ('accepted', 'declined')),
  reapply_at timestamptz,
  composite_score numeric not null,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  university_id uuid not null references public.universities (id),
  course_id uuid not null references public.courses (id),
  level_year smallint not null default 1 check (level_year between 1 and 7),
  status text not null default 'active' check (status in ('active', 'graduated', 'withdrawn')),
  enrolled_at timestamptz not null default now()
);
create unique index enrollments_one_active_idx on public.enrollments (player_id) where status = 'active';

-- Reveals the result. Safe to call twice: it only acts once.
create function public.reveal_result(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_app public.applications%rowtype;
  v_score smallint; v_bonus smallint; v_composite numeric;
  v_ch record; v_alt record;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  select * into v_app from public.applications
  where player_id = v_player and status = 'awaiting_result' for update;
  if not found then return; end if;

  if now() < v_app.result_ready_at then raise exception 'result not ready'; end if;

  select a.score into v_score from public.exam_attempts a where a.application_id = v_app.id;
  select b.academic_bonus into v_bonus
  from public.players p join public.backgrounds b on b.slug = p.background_slug
  where p.id = v_player;

  -- Exam mark out of 100, a small background boost, and a swing of up to 4 points either way.
  v_composite := coalesce(v_score, 0) * 10 + coalesce(v_bonus, 0) * 2 + (random() * 8 - 4);

  for v_ch in
    select ac.rank, ac.university_id, ac.course_id, c.cutoff_score
    from public.application_choices ac
    join public.courses c on c.id = ac.course_id
    where ac.application_id = v_app.id
    order by ac.rank
  loop
    if v_composite >= v_ch.cutoff_score then
      insert into public.application_results
        (application_id, outcome, choice_rank, university_id, course_id, composite_score)
      values (v_app.id, 'admitted', v_ch.rank, v_ch.university_id, v_ch.course_id, v_composite);

      insert into public.enrollments (player_id, university_id, course_id)
      values (v_player, v_ch.university_id, v_ch.course_id);

      update public.applications set status = 'decided' where id = v_app.id;
      return;
    end if;
  end loop;

  -- No choice reached: look for a change-of-course offer at the highest-ranked university.
  select ac.university_id, c.id as course_id into v_alt
  from public.application_choices ac
  join public.faculties f on f.university_id = ac.university_id
  join public.departments d on d.faculty_id = f.id
  join public.courses c on c.department_id = d.id
  where ac.application_id = v_app.id and c.is_active and c.cutoff_score <= v_composite
  order by ac.rank, c.cutoff_score desc
  limit 1;

  if found then
    insert into public.application_results
      (application_id, outcome, university_id, course_id, composite_score)
    values (v_app.id, 'offer', v_alt.university_id, v_alt.course_id, v_composite);
    update public.applications set status = 'offer_pending' where id = v_app.id;
  else
    insert into public.application_results (application_id, outcome, reapply_at, composite_score)
    values (v_app.id, 'rejected', now() + interval '10 minutes', v_composite);
    update public.applications set status = 'decided' where id = v_app.id;
  end if;
end $$;

create function public.accept_offer(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_app uuid; v_uni uuid; v_course uuid;
begin
  select id into v_player from public.players where user_id = p_user_id;
  select a.id into v_app from public.applications a
  where a.player_id = v_player and a.status = 'offer_pending' for update;
  if v_app is null then raise exception 'no offer'; end if;

  select r.university_id, r.course_id into v_uni, v_course
  from public.application_results r
  where r.application_id = v_app and r.outcome = 'offer' and r.offer_response is null;
  if v_uni is null then raise exception 'no offer'; end if;

  insert into public.enrollments (player_id, university_id, course_id)
  values (v_player, v_uni, v_course);
  update public.application_results set offer_response = 'accepted' where application_id = v_app;
  update public.applications set status = 'decided' where id = v_app;
end $$;

create function public.decline_offer(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_app uuid;
begin
  select id into v_player from public.players where user_id = p_user_id;
  select a.id into v_app from public.applications a
  where a.player_id = v_player and a.status = 'offer_pending' for update;
  if v_app is null then raise exception 'no offer'; end if;

  update public.application_results
  set offer_response = 'declined', reapply_at = now() + interval '10 minutes'
  where application_id = v_app;
  update public.applications set status = 'decided' where id = v_app;
end $$;

-- Applying now respects enrolment and the reapply cooldown.
create or replace function public.submit_application(
  p_user_id uuid, p_course_code text, p_university_ids uuid[]
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_player uuid; v_app uuid; v_rank int := 0;
  v_uni uuid; v_course uuid; v_count int;
begin
  select id into v_player from public.players where user_id = p_user_id;
  if v_player is null then raise exception 'no character'; end if;

  if exists (select 1 from public.enrollments where player_id = v_player and status = 'active') then
    raise exception 'already enrolled';
  end if;
  if exists (
    select 1 from public.application_results r
    join public.applications a on a.id = r.application_id
    where a.player_id = v_player and r.reapply_at > now()
  ) then
    raise exception 'reapply cooldown';
  end if;

  v_count := coalesce(array_length(p_university_ids, 1), 0);
  if v_count < 1 or v_count > 3 then raise exception 'choose 1 to 3 universities'; end if;
  if (select count(distinct x) from unnest(p_university_ids) as x) <> v_count then
    raise exception 'duplicate university';
  end if;

  insert into public.applications (player_id, exam_opens_at)
  values (v_player, now() + interval '60 seconds')
  returning id into v_app;

  foreach v_uni in array p_university_ids loop
    v_rank := v_rank + 1;
    v_course := null;

    select c.id into v_course
    from public.courses c
    join public.departments d on d.id = c.department_id
    join public.faculties f on f.id = d.faculty_id
    join public.universities u on u.id = f.university_id
    where u.id = v_uni and u.is_active and c.is_active and c.code = p_course_code;

    if v_course is null then raise exception 'course not offered'; end if;

    insert into public.application_choices (application_id, rank, university_id, course_id)
    values (v_app, v_rank, v_uni, v_course);
  end loop;

  return v_app;
end $$;

revoke all on function public.reveal_result(uuid) from public, anon, authenticated;
revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
revoke all on function public.decline_offer(uuid) from public, anon, authenticated;
grant execute on function public.reveal_result(uuid) to service_role;
grant execute on function public.accept_offer(uuid) to service_role;
grant execute on function public.decline_offer(uuid) to service_role;

alter table public.application_results enable row level security;
alter table public.enrollments enable row level security;
revoke all on public.application_results, public.enrollments from anon, authenticated;
-- Players can read their own result, but never the hidden composite score.
grant select (application_id, outcome, choice_rank, university_id, course_id,
              offer_response, reapply_at, created_at)
  on public.application_results to authenticated;
grant select on public.enrollments to authenticated;

create policy "results: read own" on public.application_results
  for select to authenticated using (exists (
    select 1 from public.applications a
    join public.players p on p.id = a.player_id
    where a.id = application_id and p.user_id = (select auth.uid())));

create policy "enrollments: read own" on public.enrollments
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.id = player_id and p.user_id = (select auth.uid())));