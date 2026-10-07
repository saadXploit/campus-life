"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Countdown from "@/components/Countdown";
import RefreshButton from "@/components/RefreshButton";
import UniversityCrest from "@/components/UniversityCrest";
import type { AvatarAction } from "@/components/scene/Avatar3D";
import type { WorldAvatar, WorldLocation } from "@/components/world/CampusWorld";
import { BED_SPOT, ENTRY_SPOT, hasInterior, spotFor, type Spot } from "@/lib/game/interiors";
import { formatClock } from "@/lib/game/time";
import { travelCost, travelHours } from "@/lib/game/travel";
import { formatNaira } from "@/lib/money";
import { travelAction } from "../campus/actions";
import NotificationsPanel from "./NotificationsPanel";
import WalletPanel from "./WalletPanel";
import { performActivityAction, wakeUpAction } from "./actions";

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
      Loading your campus...
    </div>
  );
}

const CampusWorld = dynamic(() => import("@/components/world/CampusWorld"), {
  ssr: false,
  loading: Loading,
});

const InteriorScene = dynamic(() => import("@/components/world/InteriorScene"), {
  ssr: false,
  loading: Loading,
});

export type GameActivity = {
  slug: string;
  name: string;
  description: string;
  location_kind: string;
  duration_hours: number;
  energy_delta: number;
  health_delta: number;
  happiness_delta: number;
  cost_kobo: number;
  ends_day: boolean;
};

export type GameLocation = WorldLocation & { description: string };

type Props = {
  playerName: string;
  avatar: WorldAvatar;
  university: { name: string; short_name: string; primary_color: string; secondary_color: string };
  levelYear: number;
  courseName: string;
  locations: GameLocation[];
  activities: GameActivity[];
  state: {
    energy: number;
    health: number;
    happiness: number;
    hours_left: number;
    slept_today: boolean;
    locationKind: string | null;
  };
  world: { dayNumber: number; weekday: string; nextDayAt: string };
  hour: number;
  balance: number;
  unreadCount: number;
  /** False when the player is already a full day ahead of the campus calendar. */
  canWake: boolean;
};

/** Which body animation an activity plays. */
function animationFor(a: GameActivity): AvatarAction {
  if (a.ends_day || a.slug === "nap") return "sleep";
  if (a.location_kind === "sports") return "exercise";
  if (a.slug.includes("hang") || a.location_kind === "clubhouse") return "dance";
  return "busy";
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function MiniMeter({ icon, value, color }: { icon: string; value: number; color: string }) {
  const low = value < 25;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icon}</span>
      <div className="h-2 w-16 overflow-hidden rounded-full bg-white/15 sm:w-20">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: low ? "#f87171" : color }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <span className={"w-7 text-[11px] tabular-nums " + (low ? "text-red-300" : "text-zinc-200")}>
        {value}
      </span>
    </div>
  );
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function GameClient(props: Props) {
  const { state, world, locations, activities, university } = props;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  // The building the player is inside (its room is shown), or null when outdoors.
  const [inside, setInside] = useState<string | null>(
    state.slept_today && hasInterior(state.locationKind) ? state.locationKind : null
  );
  const [busy, setBusy] = useState<{
    label: string;
    action: AvatarAction;
    spot: Spot | null;
    day: number;
  } | null>(null);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"wallet" | "notifications" | null>(null);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWebgl(detectWebGL()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const here = locations.find((l) => l.kind === state.locationKind) ?? null;
  const zonePlace = locations.find((l) => l.kind === zone) ?? null;
  const atCheckedInPlace = zonePlace !== null && zonePlace.kind === state.locationKind;
  const hereActivities = activities.filter((a) => a.location_kind === state.locationKind);
  // Show a room only while the server agrees the player is there (a new day sends them home).
  const roomKind = inside !== null && inside === state.locationKind ? inside : null;
  const insidePlace = locations.find((l) => l.kind === roomKind) ?? null;

  const tripHours = here && zonePlace ? travelHours(here, zonePlace) : 0;
  const tripEnergy = travelCost(tripHours);

  const asleep = state.slept_today;
  // A sleep started yesterday is over once the new day begins.
  const activeBusy = busy && busy.day === world.dayNumber ? busy : null;
  const avatarAction: AvatarAction | null = asleep ? "sleep" : (activeBusy?.action ?? null);
  const roomSpot: Spot = asleep ? BED_SPOT : (activeBusy?.spot ?? ENTRY_SPOT);

  function enter() {
    if (!zonePlace) return;
    const kind = zonePlace.kind;
    // Already checked in here: just walk inside, no travel cost.
    if (atCheckedInPlace) {
      if (hasInterior(kind)) setInside(kind);
      return;
    }
    setError(null);
    setEntering(true);
    startTransition(async () => {
      const result = await travelAction(zonePlace.id);
      setEntering(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (hasInterior(kind)) setInside(kind);
      router.refresh();
    });
  }

  function doActivity(a: GameActivity) {
    setError(null);
    const spot = inside ? spotFor(a.slug, animationFor(a)) : null;
    setBusy({ label: a.name, action: spot?.pose ?? animationFor(a), spot, day: world.dayNumber });
    startTransition(async () => {
      const started = Date.now();
      const result = await performActivityAction(a.slug);
      // Let the character walk over and act it out so the action is visible.
      const wait = Math.max(0, (spot ? 3400 : 2200) - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (result.error) {
        setBusy(null);
        setError(result.error);
        return;
      }
      // After going to bed, stay in bed: the sleep screen takes over.
      if (!a.ends_day) setBusy(null);
      const parts: string[] = [];
      if (a.energy_delta) parts.push(`⚡ ${signed(a.energy_delta)}`);
      if (a.health_delta) parts.push(`❤️ ${signed(a.health_delta)}`);
      if (a.happiness_delta) parts.push(`😊 ${signed(a.happiness_delta)}`);
      if (a.cost_kobo) parts.push(`-${formatNaira(a.cost_kobo)}`);
      setToast(parts);
      router.refresh();
    });
  }

  function wake() {
    setError(null);
    setWaking(true);
    startTransition(async () => {
      const result = await wakeUpAction();
      setWaking(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setBusy(null);
      router.refresh();
    });
  }

  function canDo(a: GameActivity): string | null {
    if (!a.ends_day && state.hours_left < a.duration_hours) return "Not enough time";
    if (a.energy_delta < 0 && state.energy < -a.energy_delta) return "Too tired";
    if (props.balance < a.cost_kobo) return "Can't afford";
    return null;
  }


  const activityList =
    hereActivities.length === 0 ? (
      <p className="mt-2 text-sm text-zinc-400">Nothing to do here yet.</p>
    ) : (
      <div className="mt-3 flex max-h-[38vh] gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
        {hereActivities.map((a) => {
          const blocked = canDo(a);
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => doActivity(a)}
              disabled={activeBusy !== null || blocked !== null}
              className="w-44 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 disabled:opacity-40 active:scale-95 sm:w-auto"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight">{a.name}</p>
                {a.cost_kobo > 0 && (
                  <span className="text-xs font-bold text-emerald-300">{formatNaira(a.cost_kobo)}</span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-zinc-300">
                <span>⏱ {a.ends_day ? "ends day" : `${a.duration_hours}h`}</span>
                {a.energy_delta !== 0 && <span>⚡{signed(a.energy_delta)}</span>}
                {a.health_delta !== 0 && <span>❤️{signed(a.health_delta)}</span>}
                {a.happiness_delta !== 0 && <span>😊{signed(a.happiness_delta)}</span>}
              </p>
              {blocked && <p className="mt-1 text-[11px] text-amber-300">{blocked}</p>}
            </button>
          );
        })}
      </div>
    );

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0b1020] text-white">
      {/* the 3D world */}
      <div className="absolute inset-0">
        {webgl === false ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="font-bold">Your device cannot show the 3D campus.</p>
            <Link href="/campus" className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black">
              Use the campus map instead
            </Link>
          </div>
        ) : webgl && roomKind ? (
          <InteriorScene
            kind={roomKind}
            avatar={props.avatar}
            spot={roomSpot}
            hour={props.hour}
            primary={university.primary_color}
            secondary={university.secondary_color}
          />
        ) : webgl ? (
          <CampusWorld
            locations={locations}
            primary={university.primary_color}
            secondary={university.secondary_color}
            hour={props.hour}
            avatar={props.avatar}
            playerName={props.playerName}
            spawnKind={state.locationKind}
            spawnKey={String(world.dayNumber)}
            action={avatarAction}
            onZoneChange={setZone}
          />
        ) : null}
      </div>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/45 p-2 pr-3 backdrop-blur">
            <UniversityCrest
              shortName={university.short_name}
              primary={university.primary_color}
              secondary={university.secondary_color}
              className="h-10 w-9 shrink-0"
            />
            <div className="leading-tight">
              <p className="text-sm font-extrabold">{props.playerName}</p>
              <p className="text-[11px] text-zinc-300">
                {props.levelYear}00L · {props.courseName}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-black/45 px-3 py-2 text-right leading-tight backdrop-blur">
                <p className="text-lg font-black tabular-nums">{formatClock(props.hour)}</p>
                <p className="text-[11px] text-zinc-300">
                  {world.weekday} · Day {world.dayNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel("notifications")}
                aria-label={props.unreadCount ? `${props.unreadCount} new notifications` : "Notifications"}
                className="pointer-events-auto relative rounded-2xl bg-black/45 px-3 py-3 text-lg backdrop-blur"
              >
                🔔
                {props.unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold">
                    {props.unreadCount > 9 ? "9+" : props.unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-label="Menu"
                className="pointer-events-auto rounded-2xl bg-black/45 px-3 py-3 text-lg backdrop-blur"
              >
                ☰
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPanel("wallet")}
              className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-sm font-extrabold text-emerald-300 backdrop-blur"
            >
              {formatNaira(props.balance)} ›
            </button>
          </div>
        </div>

        <div className="mt-2 inline-flex flex-col gap-1 rounded-2xl bg-black/45 px-3 py-2 backdrop-blur">
          <MiniMeter icon="⚡" value={state.energy} color="#fbbf24" />
          <MiniMeter icon="❤️" value={state.health} color="#f87171" />
          <MiniMeter icon="😊" value={state.happiness} color="#e879f9" />
          <p className="text-[11px] text-amber-300">⏱ {state.hours_left}h left today</p>
        </div>

        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto absolute right-3 top-20 w-48 space-y-1 rounded-2xl border border-white/10 bg-[#10172e]/95 p-2 text-sm backdrop-blur sm:right-4"
            >
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setPanel("wallet");
                }}
                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
              >
                💰 Wallet
              </button>
              <Link href="/campus" className="block rounded-xl px-3 py-2 hover:bg-white/10">
                🗺️ Campus map
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">
                  🚪 Sign out
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* floating stat changes */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
          >
            <div className="flex gap-3 rounded-2xl bg-black/60 px-4 py-2 text-base font-extrabold backdrop-blur">
              {toast.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* activity in progress */}
      <AnimatePresence>
        {activeBusy && !asleep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center"
          >
            <div className="w-56 rounded-2xl bg-black/60 p-3 text-center backdrop-blur">
              <p className="text-sm font-bold">{activeBusy.label}...</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  className="h-full bg-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: activeBusy.spot ? 3.4 : 2.2, ease: "linear" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* asleep: the night passes until the campus clock turns over */}
      <AnimatePresence>
        {asleep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-[#050816]/90 to-transparent pb-10 pt-24"
          >
            <div className="pointer-events-auto text-center">
              <p className="text-5xl">😴</p>
              <p className="mt-3 text-xl font-extrabold">Sleeping...</p>
              {props.canWake ? (
                <button
                  type="button"
                  onClick={wake}
                  disabled={waking}
                  className="mt-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 font-extrabold text-black disabled:opacity-50 active:scale-95"
                >
                  {waking ? "Waking up..." : "Wake up"}
                </button>
              ) : (
                <>
                  <p className="mt-1 text-sm text-zinc-300">
                    You are a full day ahead. You can wake up in
                  </p>
                  <p className="mt-2 text-3xl font-black">
                    <Countdown target={world.nextDayAt}>
                      <RefreshButton>Wake up</RefreshButton>
                    </Countdown>
                  </p>
                </>
              )}
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* context panel at the bottom */}
      {!asleep && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <div className="pointer-events-auto mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#0b1020]/85 p-4 backdrop-blur">
            {error && (
              <p className="mb-3 rounded-xl bg-red-500/15 p-2 text-center text-sm text-red-200">
                {error}
              </p>
            )}

            {roomKind && insidePlace ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">INSIDE</p>
                    <p className="text-lg font-extrabold">{insidePlace.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInside(null)}
                    disabled={activeBusy !== null}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Leave
                  </button>
                </div>
                {activityList}
              </>
            ) : zonePlace && atCheckedInPlace && !hasInterior(zonePlace.kind) ? (
              <>
                <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">YOU ARE AT</p>
                <p className="text-lg font-extrabold">{zonePlace.name}</p>
                {activityList}
              </>
            ) : zonePlace ? (
              <>
                <p className="text-lg font-extrabold">{zonePlace.name}</p>
                <p className="text-sm text-zinc-400">{zonePlace.description}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={enter}
                    disabled={
                      entering ||
                      (!atCheckedInPlace && (state.hours_left < tripHours || state.energy < tripEnergy))
                    }
                    className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-extrabold text-black disabled:opacity-40 active:scale-95"
                  >
                    {entering
                      ? "Going in..."
                      : atCheckedInPlace
                        ? "Enter"
                        : hasInterior(zonePlace.kind)
                          ? "Go in"
                          : "Go there"}
                  </button>
                  {!atCheckedInPlace && (
                    <p className="text-xs text-zinc-300">
                      ⏱ {tripHours}h · ⚡ -{tripEnergy}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-zinc-300">
                {here ? (
                  <>
                    Checked in at <span className="font-bold text-white">{here.name}</span>. Walk
                    to any glowing circle to go somewhere.
                  </>
                ) : (
                  "Walk to any glowing circle to go somewhere."
                )}
                <span className="mt-1 block text-xs text-zinc-500">
                  WASD or arrow keys to walk (Shift to run) · tap the ground or a building
                </span>
              </p>
            )}
          </div>
        </div>
      )}
      {panel === "wallet" && (
        <WalletPanel balance={props.balance} onClose={() => setPanel(null)} onSent={() => router.refresh()} />
      )}
      {panel === "notifications" && (
        <NotificationsPanel onClose={() => setPanel(null)} onOpened={() => router.refresh()} />
      )}
    </main>
  );
}
