-- CAMPUS LIFE: Stage 14 - cars, bicycles, scooters and okada off the shop for now
-- They are switched off, not deleted, so they can come back later with one update.
-- Anyone who bought a car with game money gets that money back. Safe to run more than once.

update public.shop_items set is_active = false where category in ('car', 'ride');

do $$
declare r record;
begin
  for r in
    select pi.player_id, pi.item_slug, pi.purchase_id, s.name, s.game_price_kobo
    from public.player_items pi
    join public.shop_items s on s.slug = pi.item_slug
    where s.category in ('car', 'ride')
  loop
    -- Bought with game money (no Paystack order): give the money back.
    if r.purchase_id is null and coalesce(r.game_price_kobo, 0) > 0 then
      perform public.wallet_apply(r.player_id, r.game_price_kobo, 'refund',
        'Refund: ' || r.name || ' (cars are off the shop for now)');
      insert into public.notifications (player_id, kind, title, body)
      values (r.player_id, 'purchase', '🚗 Cars are off the shop for now',
              'We refunded ₦' || to_char(r.game_price_kobo / 100, 'FM999,999,990') || ' for your ' || r.name || '.');
      delete from public.player_items where player_id = r.player_id and item_slug = r.item_slug;
    end if;
  end loop;

  -- Nobody drives while cars are off.
  update public.players set style = style - 'car' where style ? 'car';
  -- Close any open lift offers.
  update public.rides set expires_at = now() where expires_at > now();
end $$;
