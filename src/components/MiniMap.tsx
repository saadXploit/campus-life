"use client";

import { useState } from "react";
import type { GameLocation, Person } from "@/lib/game/gameTypes";
import { doingLabel, PLACE_ICONS, spread } from "@/lib/game/minimap";

/** The campus drawn as a small map: buildings, the ring road, friends and you. */
function MapSvg({
big,
locations,
hereKind,
groups,
myPoint,
}: {
big: boolean;
locations: GameLocation[];
hereKind: string | null;
groups: [string, Person[]][];
myPoint: { mx: number; my: number } | null;
}) {
const place = (kind: string) => locations.find((l) => l.kind === kind) ?? null;
  return (
    <svg viewBox="-4 -4 108 108" className="h-full w-full" role="img" aria-label="Campus map">
      <rect x="-4" y="-4" width="108" height="108" rx="10" fill="#14361f" />
      {/* the ring road */}
      <rect x="2.5" y="2.5" width="95" height="95" rx="3" fill="none" stroke="#3f3f46" strokeWidth="3" />
      {locations.map((l) => {
        const mine = l.kind === hereKind;
        return (
          <g key={l.id}>
            <rect
              x={l.map_x - 5}
              y={l.map_y - 4}
              width="10"
              height="8"
              rx="2"
              fill={mine ? "#f59e0b" : "#475569"}
              opacity={mine ? 0.9 : 0.75}
            />
            {big && (
              <text x={l.map_x} y={l.map_y + 1.6} textAnchor="middle" fontSize="5">
                {PLACE_ICONS[l.kind] ?? "•"}
              </text>
            )}
            {big && (
              <text x={l.map_x} y={l.map_y + 9} textAnchor="middle" fontSize="3.4" fill="#e2e8f0">
                {l.name}
              </text>
            )}
          </g>
        );
      })}
      {groups.map(([kind, list]) => {
        const p = place(kind);
        if (!p) return null;
        return list.map((f, i) => {
          const { dx, dy } = spread(i, list.length, big ? 4 : 3.4);
          return (
            <g key={f.id}>
              <circle cx={p.map_x + dx} cy={p.map_y + dy} r={big ? 2.6 : 2.4} fill="#34d399" stroke="#052e16" strokeWidth="0.8" />
              {big && (
                <text x={p.map_x + dx} y={p.map_y + dy - 3.4} textAnchor="middle" fontSize="3" fill="#bbf7d0">
                  {f.name}
                </text>
              )}
            </g>
          );
        });
      })}
      {myPoint && (
        <g>
          <circle cx={myPoint.mx} cy={myPoint.my} r={big ? 3.6 : 3.2} fill="#fbbf24" opacity="0.35" />
          <circle cx={myPoint.mx} cy={myPoint.my} r={big ? 2.2 : 2} fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
        </g>
      )}
    </svg>
  );
}


/**
 * A small campus map in the corner: the buildings, you, and your friends (green dots).
 * Tap it for a bigger map and a list of where each friend is and what they are doing.
 */
export default function MiniMap({
  locations,
  me,
  hereKind,
  friends,
  activityName,
  onJoin,
}: {
  locations: GameLocation[];
  /** Your live position on the 0-100 map (outdoors), or null to use the place you are at. */
  me: { mx: number; my: number } | null;
  hereKind: string | null;
  /** Friends who are online right now. */
  friends: Person[];
  activityName: (slug: string) => string | null;
  /** Join a friend at your place who is in another room. */
  onJoin: (p: Person) => void;
}) {
  const [open, setOpen] = useState(false);
  const place = (kind: string) => locations.find((l) => l.kind === kind) ?? null;
  const here = hereKind ? place(hereKind) : null;
  const myPoint = me ?? (here ? { mx: here.map_x, my: here.map_y } : null);

  // Friends grouped by place, so dots at the same place spread into a small ring.
  const byPlace = new Map<string, Person[]>();
  for (const f of friends) {
    const list = byPlace.get(f.location_kind) ?? [];
    list.push(f);
    byPlace.set(f.location_kind, list);
  }
  const groups = [...byPlace.entries()];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Campus map: ${friends.length} friends online`}
        className="pointer-events-auto relative h-24 w-24 overflow-hidden rounded-2xl border border-white/15 shadow-lg sm:h-28 sm:w-28"
      >
        <MapSvg big={false} locations={locations} hereKind={hereKind} groups={groups} myPoint={myPoint} />
        <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-emerald-300">
          💚 {friends.length}
        </span>
      </button>

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#10172e] p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">CAMPUS MAP</p>
                <p className="text-sm text-zinc-400">
                  <span className="text-amber-300">●</span> You · <span className="text-emerald-300">●</span> Friends online
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-xl text-zinc-400">
                ✕
              </button>
            </div>
            <div className="mx-auto mt-3 aspect-square w-full max-w-sm">
              <MapSvg big locations={locations} hereKind={hereKind} groups={groups} myPoint={myPoint} />
            </div>

            <p className="mt-4 text-xs font-semibold tracking-[0.15em] text-zinc-400">FRIENDS ONLINE</p>
            {friends.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-400">
                None of your friends are online right now. Meet people around campus or search for them in 👥 Friends.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {friends.map((f) => {
                  const where = place(f.location_kind);
                  const sameRoom = f.same_room;
                  const samePlace = f.location_kind === hereKind;
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">💚 {f.name}</p>
                        <p className="truncate text-xs text-zinc-400">
                          {PLACE_ICONS[f.location_kind] ?? ""} {where?.name ?? "On campus"}
                          {f.room > 1 || f.location_kind === "hostel" ? ` · Room ${f.room}` : ""} ·{" "}
                          {doingLabel(f, activityName)}
                        </p>
                      </div>
                      {sameRoom ? (
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-300">With you</span>
                      ) : samePlace ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            onJoin(f);
                          }}
                          className="shrink-0 rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black"
                        >
                          Join
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
