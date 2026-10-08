"use client";

import { useState } from "react";
import type { GameActivity, Person } from "@/lib/game/gameTypes";
import { formatNaira } from "@/lib/money";

/** Invite friends to do an activity with you, and choose who pays. */
export default function OutingSheet({
  activity,
  friends,
  balance,
  pending,
  onSend,
  onClose,
}: {
  activity: GameActivity;
  /** Friends who are online right now. */
  friends: Person[];
  balance: number;
  pending: boolean;
  onSend: (friendIds: string[], hostPays: boolean) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [hostPays, setHostPays] = useState(true);
  const paid = activity.cost_kobo > 0;
  const total = activity.cost_kobo * (picked.length + 1);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 7 ? p : [...p, id]));
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">DO IT TOGETHER</p>
            <p className="text-xl font-extrabold">{activity.name}</p>
            <p className="text-sm text-zinc-400">
              You start now. Friends you invite come to you and join in (up to 7).
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold text-zinc-400">FRIENDS ONLINE</p>
        {friends.length === 0 ? (
          <p className="mt-2 rounded-xl bg-white/5 p-3 text-sm text-zinc-300">
            None of your friends are online right now. Try again later.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm font-semibold " +
                  (picked.includes(f.id)
                    ? "border-emerald-400 bg-emerald-400/20 text-emerald-100"
                    : "border-white/15 bg-white/5")
                }
              >
                {picked.includes(f.id) ? "✓ " : ""}
                {f.name}
                {f.asleep && " 😴"}
              </button>
            ))}
          </div>
        )}

        {paid && (
          <>
            <p className="mt-4 text-xs font-semibold text-zinc-400">WHO PAYS? ({formatNaira(activity.cost_kobo)} each)</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHostPays(true)}
                className={
                  "rounded-xl border p-3 text-left text-sm " +
                  (hostPays ? "border-amber-400 bg-amber-400/15" : "border-white/15 bg-white/5")
                }
              >
                <span className="font-bold">I&apos;ll pay for everyone</span>
                <span className="block text-[11px] text-zinc-400">
                  {formatNaira(total)} in all. They&apos;ll be told you paid.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHostPays(false)}
                className={
                  "rounded-xl border p-3 text-left text-sm " +
                  (!hostPays ? "border-amber-400 bg-amber-400/15" : "border-white/15 bg-white/5")
                }
              >
                <span className="font-bold">Everyone pays</span>
                <span className="block text-[11px] text-zinc-400">Each person pays their own.</span>
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => onSend(picked, paid && hostPays)}
          disabled={pending || picked.length === 0 || (paid && hostPays && balance < total)}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-40"
        >
          {paid && hostPays && balance < total
            ? "Not enough money to pay for everyone"
            : `Start and invite ${picked.length || ""} ${picked.length === 1 ? "friend" : "friends"}`}
        </button>
      </div>
    </div>
  );
}
