"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { travelCost, travelHours } from "@/lib/game/travel";
import { travelAction } from "./actions";

export type MapLocation = {
  id: string;
  name: string;
  kind: string;
  description: string;
  map_x: number;
  map_y: number;
  has_billboard: boolean;
};

const ICONS: Record<string, string> = {
  hostel: "🏠",
  faculty: "🏫",
  library: "📚",
  cafeteria: "🍲",
  market: "🛒",
  sports: "⚽",
  clubhouse: "🎶",
  health: "🏥",
};

export default function CampusMap({
  locations,
  currentKind,
  hoursLeft,
  energy,
  primary,
  secondary,
}: {
  locations: MapLocation[];
  currentKind: string | null;
  hoursLeft: number;
  energy: number;
  primary: string;
  secondary: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = locations.find((l) => l.kind === currentKind) ?? null;
  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const hub = locations.find((l) => l.kind === "faculty") ?? null;

  const hours = current && selected ? travelHours(current, selected) : 0;
  const cost = travelCost(hours);
  const enoughTime = hoursLeft >= hours;
  const enoughEnergy = energy >= cost;

  function go() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await travelAction(selected.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelectedId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-white/10"
        style={{ background: `radial-gradient(circle at 50% 40%, ${primary}66, #0b1020 78%)` }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {hub &&
            locations
              .filter((l) => l.id !== hub.id)
              .map((l) => (
                <line
                  key={l.id}
                  x1={hub.map_x}
                  y1={hub.map_y}
                  x2={l.map_x}
                  y2={l.map_y}
                  stroke={secondary}
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
        </svg>

        {locations.map((l) => {
          const isCurrent = current?.id === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setSelectedId(l.id);
                setError(null);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${l.map_x}%`, top: `${l.map_y}%` }}
            >
              <motion.span
                animate={isCurrent ? { scale: [1, 1.12, 1] } : undefined}
                transition={isCurrent ? { duration: 1.6, repeat: Infinity } : undefined}
                className={
                  "relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl backdrop-blur " +
                  (isCurrent
                    ? "border-amber-400 bg-amber-400/25"
                    : selectedId === l.id
                      ? "border-white bg-white/20"
                      : "border-white/25 bg-black/30")
                }
              >
                {ICONS[l.kind]}
                {l.has_billboard && (
                  <span className="absolute -right-1 -top-1 text-xs" aria-label="Billboard">
                    🪧
                  </span>
                )}
              </motion.span>
              <span className="mt-1 block max-w-[4.5rem] text-[10px] font-semibold leading-tight text-zinc-100">
                {l.name}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-zinc-500">
        Tap a place to see how far it is.
      </p>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-white/15 bg-[#10172e] px-5 pb-8 pt-5"
          >
            <div className="mx-auto max-w-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-extrabold">
                    {ICONS[selected.kind]} {selected.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">{selected.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                  className="text-lg text-zinc-400"
                >
                  ✕
                </button>
              </div>

              {selected.has_billboard && (
                <p className="mt-2 text-xs text-zinc-500">🪧 A billboard stands here.</p>
              )}

              {selected.id === current?.id ? (
                <p className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-center text-sm text-emerald-300">
                  You are here. Activities arrive in the next update.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-zinc-500">Travel time</p>
                      <p className="font-bold">{hours} hours</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-zinc-500">Energy</p>
                      <p className="font-bold">-{cost}</p>
                    </div>
                  </div>

                  {!enoughTime && (
                    <p className="mt-3 text-center text-sm text-amber-300">
                      Not enough hours left today.
                    </p>
                  )}
                  {enoughTime && !enoughEnergy && (
                    <p className="mt-3 text-center text-sm text-amber-300">
                      Too tired to walk that far.
                    </p>
                  )}
                  {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}

                  <button
                    type="button"
                    onClick={go}
                    disabled={pending || !enoughTime || !enoughEnergy}
                    className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black disabled:opacity-40 active:scale-95"
                  >
                    {pending ? "Walking..." : "Go there"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}