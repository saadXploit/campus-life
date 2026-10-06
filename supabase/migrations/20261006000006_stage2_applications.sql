-- CAMPUS LIFE: Stage 2D - applications

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'exam_pending'
    check (status in ('exam_pending', 'exam_in_progress', 'awaiting_result', 'decided')),
  exam_opens_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- A player can have only ONE open application at a time.
create unique index applications_one_open_idx
  on public.applications (player_id) where status <> 'decided';

create table public.application_choices (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  university_id uuid not null references public.universities (id),
  course_id uuid not null references public.courses (id),
  unique (application_id, rank),
  unique (application_id, university_id)
);

create function public.submit_application(
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

  v_count := coalesce(array_length(p_university_ids, 1), 0);
  if v_count < 1 or v_count > 3 then raise exception 'choose 1 to 3 universities'; end if;
  if (select count(distinct x) from unnest(p_university_ids) as x) <> v_count then
    raise exception 'duplicate university';
  end if;

  -- The exam opens 60 seconds after submitting (tunable later).
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

revoke all on function public.submit_application(uuid, text, uuid[])
  from public, anon, authenticated;
grant execute on function public.submit_application(uuid, text, uuid[]) to service_role;

alter table public.applications enable row level security;
alter table public.application_choices enable row level security;
revoke all on public.applications, public.application_choices from anon, authenticated;
grant select on public.applications, public.application_choices to authenticated;

create policy "applications: read own" on public.applications
  for select to authenticated using (exists (
    select 1 from public.players p
    where p.id = player_id and p.user_id = (select auth.uid())));

create policy "choices: read own" on public.application_choices
  for select to authenticated using (exists (
    select 1 from public.applications a
    join public.players p on p.id = a.player_id
    where a.id = application_id and p.user_id = (select auth.uid())));