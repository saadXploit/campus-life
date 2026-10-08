"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CATEGORY_LABELS, type ShopData, type ShopItem } from "@/lib/game/shop";
import { formatNaira } from "@/lib/money";
import { buyAction, buyWithGameAction, equipAction, shopAction, type GameBuyResult } from "./shop-actions";

type Shop = ShopData & { payments: boolean; test_mode: boolean };

const ORDER: ShopItem["category"][] = ["car", "outfit", "look", "room", "status", "ride", "move", "social"];

/**
 * The shop. For now everything is bought with game naira. When the admin switches it to
 * real money, items are paid through Paystack instead (18+ only, never adds game naira).
 */
export default function ShopPanel({
  balance,
  onClose,
  onStyle,
  onBought,
}: {
  /** Your game money, in kobo. */
  balance: number;
  onClose: () => void;
  /** Called when you wear or take off something, with your new style. */
  onStyle: (style: Record<string, string>) => void;
  /** Called after a game-money purchase with the fresh game state. */
  onBought: (result: NonNullable<GameBuyResult["dynamic"]>) => void;
}) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [tab, setTab] = useState<ShopItem["category"]>("outfit");
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [confirmAge, setConfirmAge] = useState(false);
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    void shopAction().then((s) => live && setShop(s));
    return () => {
      live = false;
    };
  }, []);

  function equip(item: ShopItem, on: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await equipAction(item.slug, on);
      if (r.error || !r.style) {
        setError(r.error ?? "That did not work.");
        return;
      }
      const style = r.style;
      setShop((s) => (s ? { ...s, style } : s));
      onStyle(style);
    });
  }

  function payWithGameMoney() {
    if (!buying) return;
    const item = buying;
    setError(null);
    startTransition(async () => {
      const r = await buyWithGameAction(item.slug);
      if (r.error || !r.dynamic) {
        setError(r.error ?? "That did not work.");
        return;
      }
      const result = r.dynamic;
      setShop((sh) =>
        sh
          ? { ...sh, style: result.style, items: sh.items.map((i) => (i.slug === item.slug ? { ...i, owned: true } : i)) }
          : sh
      );
      setBuying(null);
      onBought(result);
    });
  }

  function pay() {
    if (!buying) return;
    setError(null);
    startTransition(async () => {
      const r = await buyAction(buying.slug, confirmAge, needEmail ? email : undefined);
      if (r.needEmail) {
        setNeedEmail(true);
        setError("Enter the email Paystack should send your receipt to.");
        return;
      }
      if (r.error || !r.url) {
        setError(r.error ?? "Could not start the payment.");
        return;
      }
      window.location.assign(r.url);
    });
  }

  // Only categories with something on sale (or already owned) get a tab.
  const tabs = shop ? ORDER.filter((c) => shop.items.some((i) => i.category === c && (i.available || i.owned))) : [];
  const activeTab = tabs.includes(tab) ? tab : (tabs[0] ?? tab);
  const items = shop?.items.filter((i) => i.category === activeTab) ?? [];
  const gameMoney = shop?.currency !== "real";
  const priceOf = (i: ShopItem) => (gameMoney ? (i.game_price_kobo ?? 0) : i.price_kobo);

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">SHOP</p>
            <p className="text-xl font-extrabold">Outfits, looks and your room</p>
            <p className="text-xs text-zinc-400">
              {gameMoney
                ? `Paid with your game money. You have ${formatNaira(balance)}.`
                : "Real money, paid securely with Paystack. Buys items only, never game naira. 18+ only."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        {shop?.test_mode && !gameMoney && (
          <p className="mt-3 rounded-xl bg-sky-400/10 p-2 text-xs text-sky-200">
            Test mode: use Paystack test cards. No real money moves.
          </p>
        )}
        {shop && !gameMoney && !shop.adult && (
          <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">
            Shop purchases are for players aged 18 and over. You can still see what is on sale.
          </p>
        )}
        {shop && !shop.open && (
          <p className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-zinc-300">The shop is closed right now.</p>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-500/15 p-2 text-sm text-red-200">{error}</p>}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold " +
                (activeTab === c ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300")
              }
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {!shop ? (
          <p className="mt-6 text-center text-sm text-zinc-400">Loading the shop...</p>
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((item) => {
              const worn = item.slot ? shop.style[item.slot] === item.slug : false;
              return (
                <div key={item.slug} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                  <span
                    className="h-10 w-10 shrink-0 rounded-xl border border-white/10"
                    style={{
                      background:
                        item.look.color ?? item.look.robe ?? item.look.shirt ?? item.look.tag ?? item.look.cap ??
                        item.look.glasses ?? item.look.chain ?? item.look.shoes ?? "#334155",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {item.name}
                      {item.seats > 1 && <span className="ml-1 text-xs text-zinc-400">· seats {item.seats}</span>}
                    </p>
                    <p className="text-xs text-zinc-400">{item.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.owned ? (
                      item.slot ? (
                        <button
                          type="button"
                          onClick={() => equip(item, !worn)}
                          disabled={pending}
                          className={
                            "rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-40 " +
                            (worn ? "border border-emerald-400/50 text-emerald-200" : "bg-emerald-400 text-black")
                          }
                        >
                          {worn ? (item.category === "car" ? "✓ Driving" : "✓ Wearing") : item.category === "car" ? "Drive" : "Wear"}
                        </button>
                      ) : (
                        <p className="text-xs font-bold text-emerald-300">✓ Owned</p>
                      )
                    ) : !item.available ? (
                      <p className="text-xs text-zinc-500">Coming soon</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setBuying(item);
                        }}
                        disabled={!shop.open || (!gameMoney && (!shop.adult || !shop.payments))}
                        className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-black disabled:opacity-40"
                      >
                        {formatNaira(priceOf(item))}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {shop && !gameMoney && !shop.payments && (
          <p className="mt-3 text-xs text-zinc-500">Payments are not switched on yet.</p>
        )}

        {buying && gameMoney && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="font-bold">
              Buy {buying.name} for {formatNaira(priceOf(buying))}?
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Paid from your game money ({formatNaira(balance)}).{" "}
              {balance < priceOf(buying) && "You need more: jobs pay ₦5,000 to ₦20,000 a shift."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={payWithGameMoney}
                disabled={pending || balance < priceOf(buying)}
                className="flex-1 rounded-xl bg-amber-400 py-2 font-extrabold text-black disabled:opacity-40"
              >
                {pending ? "Buying..." : "Buy now"}
              </button>
              <button type="button" onClick={() => setBuying(null)} className="rounded-xl border border-white/15 px-3 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {buying && !gameMoney && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="font-bold">
              Buy {buying.name} for {formatNaira(buying.price_kobo)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              You will pay on Paystack&apos;s secure page, then come straight back. The item is added as soon as the
              payment is confirmed.
            </p>
            {!shop?.age_confirmed && (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} className="mt-1" />
                <span>I confirm I am 18 or older and I am paying with my own money or with permission.</span>
              </label>
            )}
            {needEmail && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for your receipt"
                className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
              />
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={pay}
                disabled={pending || (!shop?.age_confirmed && !confirmAge) || (needEmail && !email)}
                className="flex-1 rounded-xl bg-amber-400 py-2 font-extrabold text-black disabled:opacity-40"
              >
                {pending ? "Opening Paystack..." : "Pay with Paystack"}
              </button>
              <button type="button" onClick={() => setBuying(null)} className="rounded-xl border border-white/15 px-3 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}

        {shop && shop.purchases.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-zinc-400">YOUR PURCHASES</p>
            <div className="mt-1 space-y-1 text-xs text-zinc-300">
              {shop.purchases.map((p) => (
                <p key={p.reference} className="flex justify-between gap-2">
                  <span className="truncate">
                    {p.item} · {formatNaira(p.amount_kobo)}
                  </span>
                  <span className={p.status === "paid" ? "text-emerald-300" : p.status === "failed" ? "text-red-300" : "text-zinc-500"}>
                    {p.status === "paid" ? "Paid" : p.status === "failed" ? "Failed" : p.status === "refunded" ? "Refunded" : "Not completed"}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}

        <Link href="/refunds" className="mt-4 block text-center text-[11px] text-zinc-500 underline">
          Shop and refund policy
        </Link>
      </div>
    </div>
  );
}
