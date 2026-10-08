-- CAMPUS LIFE: Stage 13 - buy shop items with game money
-- For now the shop sells everything for game naira (from jobs, transfers and your
-- starting money). Cars cost from ₦10,000 to ₦200,000. When Paystack is approved, an
-- admin can switch the shop to real money (with lower prices) without changing code.
-- Items already bought stay with their owners either way. Safe to run more than once.

insert into public.app_config (key, value) values ('shop_currency', '"game"')
on conflict (key) do nothing;

alter table public.shop_items add column if not exists game_price_kobo bigint
  check (game_price_kobo is null or game_price_kobo between 10000 and 100000000);

update public.shop_items s set game_price_kobo = v.p * 100
from (values
  ('car_corolla', 10000), ('car_accord', 25000), ('car_lexus', 60000),
  ('car_bmw', 100000), ('car_gwagon', 200000),
  ('outfit_agbada', 8000), ('outfit_ankara', 4000), ('outfit_jersey', 5000),
  ('outfit_suit', 10000), ('outfit_hoodie', 3000),
  ('look_shades', 2000), ('look_chain', 5000), ('look_cap', 2000), ('look_sneakers', 4000),
  ('room_ac', 20000), ('room_speaker', 6000), ('room_posters', 1500), ('room_led', 4000),
  ('room_fridge', 10000), ('room_ps5', 25000),
  ('tag_gold', 5000), ('tag_diamond', 15000)
) as v (slug, p)
where s.slug = v.slug;

-- 'game' (game naira) or 'real' (Paystack).
create or replace function public.shop_currency()
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.app_config where key = 'shop_currency'), 'game')
$$;

-- Buy an item with game money. Real money is never involved here.
create or replace function public.buy_with_game_money(p_user_id uuid, p_item text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_item public.shop_items%rowtype; v_style jsonb;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.config_bool('shop_open', true) then raise exception 'shop: closed'; end if;
  if public.shop_currency() <> 'game' then raise exception 'shop: real money'; end if;
  if not public.rate_limit_hit('buy:u:' || p_user_id, 20, 60) then raise exception 'slow down'; end if;

  select * into v_item from public.shop_items where slug = p_item and is_active and game_price_kobo is not null;
  if not found then raise exception 'shop: unknown item'; end if;
  if exists (select 1 from public.player_items where player_id = v_me and item_slug = v_item.slug) then
    raise exception 'shop: owned';
  end if;

  perform public.wallet_apply(v_me, -v_item.game_price_kobo, 'shop', 'Bought: ' || v_item.name);
  insert into public.player_items (player_id, item_slug) values (v_me, v_item.slug);

  -- Wear or drive it straight away.
  if v_item.slot is not null then
    update public.players set style = style || jsonb_build_object(v_item.slot, v_item.slug) where id = v_me;
  end if;
  select style into v_style from public.players where id = v_me;

  insert into public.notifications (player_id, kind, title)
  values (v_me, 'purchase', '🛍️ ' || v_item.name || ' is yours!');

  return public.game_dynamic(v_me)
    || jsonb_build_object('style', v_style, 'item', v_item.slug, 'category', v_item.category,
                          'room_item', v_item.look ->> 'item');
end $$;

-- ---------- Real-money orders only while the shop is set to real money ----------

create or replace function public.create_purchase(p_user_id uuid, p_item text, p_confirm_adult boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_item public.shop_items%rowtype; v_p public.players%rowtype; v_ref text; v_id uuid;
begin
  v_me := public.active_player_id(p_user_id);
  if not public.config_bool('shop_open', true) then raise exception 'shop: closed'; end if;
  if public.shop_currency() <> 'real' then raise exception 'shop: game money'; end if;
  if not public.rate_limit_hit('buy:u:' || p_user_id, 10, 3600) then raise exception 'slow down'; end if;

  select * into v_item from public.shop_items where slug = p_item and is_active;
  if not found then raise exception 'shop: unknown item'; end if;

  select * into v_p from public.players where id = v_me for update;
  if v_p.age < 18 then raise exception 'shop: adults only'; end if;
  if v_p.adult_confirmed_at is null then
    if not coalesce(p_confirm_adult, false) then raise exception 'shop: confirm age'; end if;
    update public.players set adult_confirmed_at = now() where id = v_me;
  end if;

  if exists (select 1 from public.player_items where player_id = v_me and item_slug = v_item.slug) then
    raise exception 'shop: owned';
  end if;

  v_ref := 'CL-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.purchases (reference, player_id, item_slug, amount_kobo)
  values (v_ref, v_me, v_item.slug, v_item.price_kobo)
  returning id into v_id;

  return jsonb_build_object('purchase_id', v_id, 'reference', v_ref,
                            'amount_kobo', v_item.price_kobo, 'name', v_item.name);
end $$;

-- ---------- The shop shows game prices and which money it takes ----------

create or replace function public.get_shop(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid; v_p public.players%rowtype;
begin
  v_me := public.active_player_id(p_user_id);
  select * into v_p from public.players where id = v_me;
  return jsonb_build_object(
    'open', public.config_bool('shop_open', true),
    'currency', public.shop_currency(),
    'adult', v_p.age >= 18,
    'age_confirmed', v_p.adult_confirmed_at is not null,
    'style', v_p.style,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', i.slug, 'category', i.category, 'slot', i.slot, 'name', i.name,
        'description', i.description, 'price_kobo', i.price_kobo, 'seats', i.seats,
        'look', i.look, 'available', i.is_active, 'game_price_kobo', i.game_price_kobo,
        'owned', exists (select 1 from public.player_items pi where pi.player_id = v_me and pi.item_slug = i.slug))
        order by i.sort_order)
      from public.shop_items i), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reference', p.reference, 'item', s.name, 'amount_kobo', p.amount_kobo,
        'status', p.status, 'created_at', p.created_at) order by p.created_at desc)
      from (select * from public.purchases where player_id = v_me order by created_at desc limit 10) p
      join public.shop_items s on s.slug = p.item_slug), '[]'::jsonb)
  );
end $$;

revoke all on function public.shop_currency() from public, anon, authenticated;
revoke all on function public.buy_with_game_money(uuid, text) from public, anon, authenticated;
grant execute on function public.buy_with_game_money(uuid, text) to service_role;
