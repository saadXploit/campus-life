do $$
declare a boolean; b boolean; c boolean; d text;
begin
  a := public.rate_limit_hit('test-key', 2, 60);
  b := public.rate_limit_hit('test-key', 2, 60);
  c := public.rate_limit_hit('test-key', 2, 60);

  begin
    set local role authenticated;
    perform public.rate_limit_hit('x', 1, 60);
    reset role;
    d := 'FAIL (a player could call it)';
  exception when others then
    reset role;
    d := 'PASS (players cannot call it)';
  end;

  raise exception E'RESULTS (rolled back): first=%, second=%, third=% (expected true, true, false). %', a, b, c, d;
end $$;