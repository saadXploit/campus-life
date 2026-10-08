"use client";

import { useState } from "react";
import type { GameLocation, Person } from "@/lib/game/gameTypes";

/** Drive your car somewhere and offer friends a lift (up to 3). */
export default function DriveSheet({
  carName,
  seats,
  locations,
  hereKind,
  friends,
  pending,
  onDrive,
  onClose,
}: {
  carName: string;
  seats: number;
  locations: GameLocation[];
  hereKind: string | null;
  /** Friends who are online right now. */
  friends: Person[];
  pending: boolean;
  onDrive: (location: GameLocation, friendIds: string[]) => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState<GameLocation | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const free = Math.max(0, seats - 1);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= free ? p : [...p, id]));
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-300">🚗 DRIVE</p>
            <p className="text-xl font-extrabold">{carName}</p>
            <p className="text-sm text-zinc-400">Driving anywhere on campus costs just ⚡ 1.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl text-zinc-400">
            ✕
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold text-zinc-400">WHERE TO?</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {locations
            .filter((l) => l.kind !== hereKind)
            .map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setTo(l)}
                className={
                  "rounded-xl border px-3 py-2 text-left text-sm " +
                  (to?.id === l.id ? "border-amber-400 bg-amber-400/15" : "border-white/15 bg-white/5")
                }
              >
                {l.name}
              </button>
            ))}
        </div>

        <p className="mt-4 text-xs font-semibold text-zinc-400">
          OFFER A LIFT ({picked.length}/{free} seats)
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No friends online right now. You can drive alone.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm font-semibold " +
                  (picked.includes(f.id) ? "border-emerald-400 bg-emerald-400/20" : "border-white/15 bg-white/5")
                }
              >
                {picked.includes(f.id) ? "✓ " : ""}
                {f.name}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => to && onDrive(to, picked)}
          disabled={!to || pending}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-40"
        >
          {pending ? "Driving..." : to ? `Drive to ${to.name}` : "Pick a place"}
        </button>
      </div>
    </div>
  );
}
