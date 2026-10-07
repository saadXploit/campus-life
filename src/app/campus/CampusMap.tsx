"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition, type PointerEvent, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { CameraControl } from "@/components/world/CampusOverview";
import type { GameAd, GameLocation } from "@/lib/game/gameTypes";
import { lagosHour } from "@/lib/game/time";
import { travelEnergy } from "@/lib/game/travel";
import AdCard from "../home/AdCard";
import { travelAction } from "../home/actions";
import { snapshotAction } from "../home/social-actions";

const CampusOverview = dynamic(() => import("@/components/world/CampusOverview"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">Loading the map...</div>
  ),
});

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

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CampusMap({
  locations,
  currentKind,
  energy,
  primary,
  secondary,
  ads,
  serverTime,
}: {
  locations: GameLocation[];
  currentKind: string | null;
  energy: number;
  primary: string;
  secondary: string;
  ads: GameAd[];
  serverTime: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openAd, setOpenAd] = useState<GameAd | null>(null);
  const control = useRef<CameraControl>({ yaw: 0.6, zoom: 1, moved: 0 });
  const drag = useRef<{ x: number; id: number } | null>(null);
  const hour = lagosHour(Date.parse(serverTime));

  useEffect(() => {
    const t = setTimeout(() => setWebgl(detectWebGL()), 0);
    // How many people are at each place right now.
    snapshotAction(0).then((snap) => {
      if (!snap) return;
      const c: Record<string, number> = {};
      for (const p of snap.people) c[p.location_kind] = (c[p.location_kind] ?? 0) + 1;
      setCounts(c);
    });
    return () => clearTimeout(t);
  }, []);

  const current = locations.find((l) => l.kind === currentKind) ?? null;
  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const cost = current && selected ? travelEnergy(current, selected) : 0;
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
      // Arrive there in the 3D campus.
      router.push("/home");
    });
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, id: e.pointerId };
    control.current.moved = 0;
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    drag.current.x = e.clientX;
    control.current.yaw -= dx * 0.008;
    control.current.moved += Math.abs(dx);
  }
  function up() {
    drag.current = null;
  }
  function wheel(e: WheelEvent<HTMLDivElement>) {
    control.current.zoom = Math.max(0.45, Math.min(1.5, control.current.zoom + e.deltaY * 0.001));
  }
  function zoomBy(d: number) {
    control.current.zoom = Math.max(0.45, Math.min(1.5, control.current.zoom + d));
  }

  return (
    <>
      <div
        className="relative h-[62dvh] w-full touch-none overflow-hidden rounded-3xl border border-white/10"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
      >
        {webgl === false ? (
          <div className="grid h-full grid-cols-2 gap-2 overflow-y-auto p-3">
            {locations.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className="rounded-xl bg-white/5 p-3 text-left text-sm font-semibold"
              >
                {ICONS[l.kind]} {l.name}
                {l.kind === currentKind && <span className="block text-xs text-amber-300">You are here</span>}
              </button>
            ))}
          </div>
        ) : webgl ? (
          <CampusOverview
            locations={locations}
            primary={primary}
            secondary={secondary}
            hour={hour}
            ads={ads}
            currentKind={currentKind}
            selectedId={selectedId}
            counts={counts}
            control={control}
            onSelect={(id) => {
              setSelectedId(id);
              setError(null);
            }}
            onSelectAd={setOpenAd}
          />
        ) : null}

        {webgl && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <p className="rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-200 backdrop-blur">
              Drag to turn · tap a building
            </p>
            <div className="pointer-events-auto flex flex-col gap-1">
              <button type="button" onClick={() => zoomBy(-0.15)} aria-label="Zoom in" className="h-9 w-9 rounded-full bg-black/50 text-lg backdrop-blur">
                +
              </button>
              <button type="button" onClick={() => zoomBy(0.15)} aria-label="Zoom out" className="h-9 w-9 rounded-full bg-black/50 text-lg backdrop-blur">
                −
              </button>
            </div>
          </div>
        )}
      </div>

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
                  {(counts[selected.kind] ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-emerald-300">👥 {counts[selected.kind]} here now</p>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Close" className="text-lg text-zinc-400">
                  ✕
                </button>
              </div>

              {selected.id === current?.id ? (
                <button
                  type="button"
                  onClick={() => router.push("/home")}
                  className="mt-4 w-full rounded-2xl bg-emerald-500/20 py-4 font-bold text-emerald-200"
                >
                  You are here · back to the game
                </button>
              ) : (
                <>
                  <p className="mt-4 text-center text-sm text-zinc-300">⚡ -{cost} energy to walk there</p>
                  {!enoughEnergy && (
                    <p className="mt-2 text-center text-sm text-amber-300">Too tired to walk that far.</p>
                  )}
                  {error && <p className="mt-2 text-center text-sm text-red-300">{error}</p>}
                  <button
                    type="button"
                    onClick={go}
                    disabled={pending || !enoughEnergy}
                    className="mt-3 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-base font-extrabold text-black disabled:opacity-40 active:scale-95"
                  >
                    {pending ? "Walking..." : "Go there"}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {openAd && <AdCard ad={openAd} onClose={() => setOpenAd(null)} />}
    </>
  );
}
