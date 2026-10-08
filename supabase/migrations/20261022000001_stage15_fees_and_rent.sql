-- CAMPUS LIFE: Stage 15 - school fees and rent
-- Every semester students owe school fees (set by their university) and rent (set by
-- the room type they choose, priced per university type). Both are due two weeks into
-- the semester. After that a 10% late fee is added once, and:
--   * unpaid school fees: you cannot write exams
--   * unpaid rent: the porter switches off your room's light and fan, so sleep restores
--     only half the energy
-- The semester you were admitted in is already covered by your admission.
-- Safe to run more than once.

insert into public.app_config (key, value) values
  ('fees_due_days', '14'),
  ('fees_late_percent', '10'),
  ('rent_unpaid_sleep_percent', '50')
on conflict (key) do nothing;

-- The room type you want (it applies to the next rent bill that is not yet paid).
alter table public.players add column if not exists accommodation_slug text not null default 'hostel-shared'
  references public.accommodation_types (slug);

create table if not exists public.bills (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  semester_idx integer not null,
  kind text not null check (kind in ('tuition', 'rent')),
  accommodation_slug text references public.accommodation_types (slug),
  amount_kobo bigint not null check (amount_kobo >= 0),
  late_fee_kobo bigint not null default 0 check (late_fee_kobo >= 0),
  due_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, semester_idx, kind)
);
alter table public.bills enable row level security;
revoke all on public.bills from anon, authenticated;
create index if not exists bills_unpaid_idx on public.bills (player_id) where paid_at is null;

-- The semester a moment falls in (same calendar as academics).
create or replace function public.semester_index_at(p_at timestamptz)
returns int
language sql stable security definer set search_path = ''
as $$
  select floor(extract(epoch from (p_at - coalesce(
           (select (value #>> '{}')::timestamptz from public.app_config where key = 'academic_epoch'),
           '2026-10-05T00:00:00+01:00'::timestamptz))) / 86400
         / (public.config_number('lecture_days', 21) + public.config_number('exam_days', 7)
            + public.config_number('holiday_days', 7)))::int
$$;

-- Creates this semester's bills (once), adds late fees, and tells the student.
create or replace function public.sync_bills(p_player uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_now record; v_enr record; v_due timestamptz; v_room text; v_rent bigint; v_new int;
begin
  select * into v_now from public.academic_now();
  select e.university_id, e.enrolled_at, u.tuition_per_semester_kobo into v_enr
  from public.enrollments e join public.universities u on u.id = e.university_id
  where e.player_id = p_player and e.status = 'active';
  if not found then return; end if;

  -- The semester you were admitted in is covered by your admission.
  if public.semester_index_at(v_enr.enrolled_at) >= v_now.idx then return; end if;

  v_due := v_now.sem_start + make_interval(days => public.config_number('fees_due_days', 14)::int);
  select accommodation_slug into v_room from public.players where id = p_player;
  select rent_per_semester_kobo into v_rent from public.university_accommodations
  where university_id = v_enr.university_id and accommodation_slug = v_room;
  if v_rent is null then
    v_room := 'hostel-shared';
    select rent_per_semester_kobo into v_rent from public.university_accommodations
    where university_id = v_enr.university_id and accommodation_slug = v_room;
  end if;

  insert into public.bills (player_id, semester_idx, kind, accommodation_slug, amount_kobo, due_at)
  values (p_player, v_now.idx, 'tuition', null, v_enr.tuition_per_semester_kobo, v_due),
         (p_player, v_now.idx, 'rent', v_room, coalesce(v_rent, 0), v_due)
  on conflict (player_id, semester_idx, kind) do nothing;
  get diagnostics v_new = row_count;
  if v_new > 0 then
    insert into public.notifications (player_id, kind, title, body)
    values (p_player, 'bill', '🧾 School fees and rent are due',
            'Pay by ' || to_char(v_due at time zone 'Africa/Lagos', 'FMDay DD Mon') ||
            ' to avoid a late fee. Unpaid fees block your exams.');
  end if;

  -- Late: add the late fee once.
  update public.bills
  set late_fee_kobo = (amount_kobo * public.config_number('fees_late_percent', 10) / 100)::bigint
  where player_id = p_player and paid_at is null and due_at < now() and late_fee_kobo = 0 and amount_kobo > 0;
end $$;

-- Owing rent after the due date this semester?
create or replace function public.rent_overdue(p_player uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.bills
                 where player_id = p_player and kind = 'rent' and paid_at is null and due_at < now())
$$;

-- The room you actually live in this semester (the one on your rent bill, if any).
create or replace function public.current_accommodation(p_player uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select b.accommodation_slug from public.bills b
     where b.player_id = p_player and b.kind = 'rent'
     order by b.semester_idx desc limit 1),
    (select accommodation_slug from public.players where id = p_player),
    'hostel-shared')
$$;

-- Your fees, rent and room choices.
create or replace function public.get_bills(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_now record; v_uni uuid; v_enrolled timestamptz;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('bills:u:' || p_user_id, 30, 60) then raise exception 'slow down'; end if;
  perform public.sync_bills(v_me);
  select * into v_now from public.academic_now();
  select university_id, enrolled_at into v_uni, v_enrolled
  from public.enrollments where player_id = v_me and status = 'active';

  return jsonb_build_object(
    'semester_idx', v_now.idx,
    'covered_by_admission', v_enrolled is not null and public.semester_index_at(v_enrolled) >= v_now.idx,
    'next_bills_at', (select b.sem_start from public.semester_bounds(v_now.idx + 1) b),
    'chosen', (select accommodation_slug from public.players where id = v_me),
    'living_in', public.current_accommodation(v_me),
    'rent_overdue', public.rent_overdue(v_me),
    'bills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'semester_idx', b.semester_idx,
        'accommodation', b.accommodation_slug, 'amount_kobo', b.amount_kobo,
        'late_fee_kobo', b.late_fee_kobo, 'due_at', b.due_at, 'paid_at', b.paid_at)
        order by b.semester_idx desc, b.kind desc)
      from (select * from public.bills where player_id = v_me order by semester_idx desc limit 6) b), '[]'::jsonb),
    'rooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'name', a.name, 'description', a.description,
        'comfort', a.comfort, 'security', a.security, 'social', a.social,
        'sleep_bonus', a.sleep_bonus, 'rent_kobo', ua.rent_per_semester_kobo) order by a.sort_order)
      from public.accommodation_types a
      join public.university_accommodations ua on ua.accommodation_slug = a.slug and ua.university_id = v_uni), '[]'::jsonb)
  );
end $$;

-- Pay a bill (with any late fee) from your wallet.
create or replace function public.pay_bill(p_user_id uuid, p_bill bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_b public.bills%rowtype; v_total bigint;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('pay:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;
  perform public.sync_bills(v_me);
  select * into v_b from public.bills where id = p_bill and player_id = v_me for update;
  if not found then raise exception 'bill: unknown'; end if;
  if v_b.paid_at is not null then return public.get_bills(p_user_id) || public.game_dynamic(v_me); end if;

  v_total := v_b.amount_kobo + v_b.late_fee_kobo;
  if v_total > 0 then
    perform public.wallet_apply(v_me, -v_total, case v_b.kind when 'tuition' then 'school_fees' else 'rent' end,
      case v_b.kind when 'tuition' then 'School fees' else 'Rent' end || ' for this semester'
      || case when v_b.late_fee_kobo > 0 then ' (with late fee)' else '' end);
  end if;
  update public.bills set paid_at = now() where id = v_b.id;

  return public.get_bills(p_user_id) || public.game_dynamic(v_me);
end $$;

-- Choose a room type. If this semester's rent is not paid yet, the bill changes now;
-- otherwise the new room starts next semester.
create or replace function public.choose_accommodation(p_user_id uuid, p_slug text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_uni uuid; v_rent bigint; v_now record;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('room:u:' || p_user_id, 10, 60) then raise exception 'slow down'; end if;
  select university_id into v_uni from public.enrollments where player_id = v_me and status = 'active';
  select rent_per_semester_kobo into v_rent from public.university_accommodations
  where university_id = v_uni and accommodation_slug = p_slug;
  if not found then raise exception 'room: unknown'; end if;

  update public.players set accommodation_slug = p_slug where id = v_me;
  select * into v_now from public.academic_now();
  update public.bills set accommodation_slug = p_slug, amount_kobo = v_rent,
    late_fee_kobo = case when late_fee_kobo > 0
                         then (v_rent * public.config_number('fees_late_percent', 10) / 100)::bigint else 0 end
  where player_id = v_me and semester_idx = v_now.idx and kind = 'rent' and paid_at is null;

  return public.get_bills(p_user_id);
end $$;

-- ---------- Waking up: room comfort and unpaid rent change how well you sleep ----------

create or replace function public.wake_up(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_player uuid; v_s public.player_state%rowtype; v_hours numeric; v_rate numeric;
begin
  v_player := public.active_player_id(p_user_id);
  if not public.rate_limit_hit('wake:u:' || p_user_id, 20, 60) then
    raise exception 'slow down';
  end if;
  perform public.sync_player_state(v_player);

  select * into v_s from public.player_state where player_id = v_player for update;
  if v_s.asleep_since is null then return public.game_dynamic(v_player); end if;

  v_hours := extract(epoch from (now() - v_s.asleep_since)) / 3600;

  -- A better room means better sleep. Unpaid rent after the due date: no light or fan.
  select public.config_number('sleep_energy_per_hour', 17) * (1 + coalesce(a.sleep_bonus, 0) / 100.0)
  into v_rate
  from public.accommodation_types a where a.slug = public.current_accommodation(v_player);
  v_rate := coalesce(v_rate, public.config_number('sleep_energy_per_hour', 17));
  if public.rent_overdue(v_player) then
    v_rate := v_rate * public.config_number('rent_unpaid_sleep_percent', 50) / 100.0;
  end if;

  update public.player_state set
    energy = least(100, energy + floor(v_hours * v_rate)::int),
    health = least(100, health + least(5, floor(v_hours))::int),
    happiness = least(100, happiness + case when v_hours >= 6 then 3 else 0 end),
    asleep_since = null,
    regen_at = now(),
    updated_at = now()
  where player_id = v_player;

  return public.game_dynamic(v_player);
end $$;

-- ---------- Exams: school fees must be paid first ----------

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
  -- No exams until school fees are paid.
  perform public.sync_bills(v_player);
  if exists (select 1 from public.bills where player_id = v_player and kind = 'tuition' and paid_at is null) then
    raise exception 'fees unpaid';
  end if;

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

revoke all on function public.semester_index_at(timestamptz) from public, anon, authenticated;
revoke all on function public.sync_bills(uuid) from public, anon, authenticated, service_role;
revoke all on function public.rent_overdue(uuid) from public, anon, authenticated;
revoke all on function public.current_accommodation(uuid) from public, anon, authenticated;
revoke all on function public.get_bills(uuid) from public, anon, authenticated;
revoke all on function public.pay_bill(uuid, bigint) from public, anon, authenticated;
revoke all on function public.choose_accommodation(uuid, text) from public, anon, authenticated;
grant execute on function public.get_bills(uuid) to service_role;
grant execute on function public.pay_bill(uuid, bigint) to service_role;
grant execute on function public.choose_accommodation(uuid, text) to service_role;
