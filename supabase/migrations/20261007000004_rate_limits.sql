-- CAMPUS LIFE: rate limits (rebuilt)
-- Safe to run more than once. Replaces any older rate_limit_hit function.

-- Remove every older version of the function, whatever its arguments were.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rate_limit_hit'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

-- One row per key (for example "apply:u:<user id>"). UNLOGGED: faster, and losing
-- counters after a database crash is harmless.
create unlogged table if not exists public.rate_limit_buckets (
  key text primary key check (length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

-- Counts one hit and says whether it is within the limit (fixed window).
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'bad rate limit';
  end if;

  insert into public.rate_limit_buckets as b (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when b.window_start <= now() - make_interval(secs => p_window_seconds)
                then 1 else b.hits + 1 end,
    window_start = case when b.window_start <= now() - make_interval(secs => p_window_seconds)
                        then now() else b.window_start end
  returning hits into v_hits;

  -- Now and then, clear out keys nobody has used for a day.
  if random() < 0.01 then
    delete from public.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end $$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
