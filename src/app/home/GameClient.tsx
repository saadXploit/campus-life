"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import AmbientSound from "@/components/AmbientSound";
import UniversityCrest from "@/components/UniversityCrest";
import type { AvatarAction } from "@/components/scene/Avatar3D";
import type { CrowdMember } from "@/components/world/CampusWorld";
import type { ShownPerson } from "@/components/world/People";
import type { AmbientKind } from "@/lib/audio/ambient";
import type {
  GameActivity,
  GameAd,
  GameDynamic,
  GameInteraction,
  GameState,
  Person,
  PlaceEvent,
  WorldSnapshot,
} from "@/lib/game/gameTypes";
import {
  BED_SPOT,
  ENTRY_SPOT,
  guestSpot,
  hasInterior,
  spotFor,
  type Pose,
  type Spot,
} from "@/lib/game/interiors";
import {
  academicBusy,
  nextLectureStart,
  phaseLabel,
  slotLabel,
  type Academics,
} from "@/lib/game/academics";
import { lightingFor } from "@/lib/game/lighting";
import { formatClock, formatDuration, lagosDateLabel, lagosHour } from "@/lib/game/time";
import { travelEnergy } from "@/lib/game/travel";
import { formatNaira } from "@/lib/money";
import AcademicsPanel from "./AcademicsPanel";
import AdCard from "./AdCard";
import NotificationsPanel from "./NotificationsPanel";
import PlayerCard from "./PlayerCard";
import WalletPanel from "./WalletPanel";
import {
  performActivityAction,
  refreshGameAction,
  travelAction,
  wakeUpAction,
  type ActionResult,
} from "./actions";
import { academicsAction, attendLectureAction, studyAction, writeExamAction } from "./academic-actions";
import { adViewAction } from "./ad-actions";
import { blockAction, interactAction, reportAction, sayAction, snapshotAction } from "./social-actions";

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

/** Shown only as a guide while asleep. The server decides the real amount on waking. */
const SLEEP_ENERGY_PER_HOUR = 17;
/** How often we ask who is around (seconds). */
const POLL_AWAKE = 6;
const POLL_ASLEEP = 20;

/** Which body animation an activity plays. */
function animationFor(a: GameActivity): AvatarAction {
  if (a.ends_day || a.slug === "nap") return "sleep";
  if (a.location_kind === "sports") return "exercise";
  if (a.slug.includes("hang") || a.location_kind === "clubhouse") return "dance";
  return "busy";
}

/** Lectures, studying and exams shown like any other activity while they run. */
function academicActivity(slug: string, kind: string | null): GameActivity | null {
  const b = academicBusy(slug);
  if (!b) return null;
  const minutes = b.kind === "study" ? (kind === "library" ? 3 : 4) : 5;
  const name =
    b.kind === "lecture" ? `Lecture: ${b.code}` : b.kind === "exam" ? `Exam: ${b.code}` : `Studying ${b.code}`;
  return {
    slug,
    name,
    description: "",
    location_kind: kind ?? "faculty",
    duration_minutes: minutes,
    energy_delta: 0,
    health_delta: 0,
    happiness_delta: 0,
    cost_kobo: 0,
    ends_day: false,
    cooldown_minutes: 0,
  };
}

/** Server time minus this device's time (only called from event handlers and effects). */
function clockSkew(serverTime: string): number {
  return Date.parse(serverTime) - Date.now();
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function readMuted(): boolean {
  try {
    return localStorage.getItem("cl_sound") === "off";
  } catch {
    return false;
  }
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

/** Progress of the current activity, counting down in real time. */
function BusyBar({
  label,
  untilMs,
  totalMs,
  skewRef,
  onDone,
}: {
  label: string;
  untilMs: number;
  totalMs: number;
  skewRef: RefObject<number>;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(totalMs);
  useEffect(() => {
    const tick = () => {
      const l = untilMs - (Date.now() + skewRef.current);
      setLeft(Math.max(0, l));
      if (l <= 0) onDone();
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [untilMs, skewRef, onDone]);

  const done = totalMs > 0 ? 1 - left / totalMs : 0;
  return (
    <div className="w-60 rounded-2xl bg-black/60 p-3 text-center backdrop-blur">
      <p className="text-sm font-bold">{label}...</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full bg-amber-400 transition-[width] duration-500" style={{ width: `${done * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-zinc-300">{formatDuration(left)} left</p>
    </div>
  );
}

/** Asleep: time passes for real and energy comes back. */
function SleepOverlay({
  asleepSince,
  energy,
  skewRef,
  waking,
  error,
  onWake,
}: {
  asleepSince: string;
  energy: number;
  skewRef: RefObject<number>;
  waking: boolean;
  error: string | null;
  onWake: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Date.now() + skewRef.current - Date.parse(asleepSince)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [asleepSince, skewRef]);

  const projected = Math.min(100, energy + Math.floor((elapsed / 3_600_000) * SLEEP_ENERGY_PER_HOUR));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2 }}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-[#050816]/90 to-transparent pb-10 pt-24"
    >
      <div className="pointer-events-auto text-center">
        <p className="text-5xl">😴</p>
        <p className="mt-2 text-xl font-extrabold">Sleeping</p>
        <p className="mt-1 text-sm text-zinc-300">Asleep for {formatDuration(elapsed)}</p>
        <p className="mt-1 text-sm text-amber-300">
          ⚡ {energy} → about {projected} if you wake now
        </p>
        <p className="mt-1 text-xs text-zinc-500">Energy comes back with real time asleep (full in about 6 hours).</p>
        <button
          type="button"
          onClick={onWake}
          disabled={waking}
          className="mt-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 font-extrabold text-black disabled:opacity-50 active:scale-95"
        >
          {waking ? "Waking up..." : "Wake up"}
        </button>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </motion.div>
  );
}

type Effect = { pose: Pose | null; bubble: string; key: number };
type FeedLine = { id: number; text: string };

export default function GameClient({ game }: { game: GameState }) {
  const { locations, activities, interactions, enrollment, ads } = game;
  const me = game.player.id;
  const university = enrollment.university;
  const [, startTransition] = useTransition();

  const [dyn, setDyn] = useState<GameDynamic>(game);
  // Server time minus this device's time, so countdowns are right even if the phone clock is off.
  const skewRef = useRef(0);
  const [now, setNow] = useState(() => Date.parse(game.server_time));

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  // The building the player is inside (its room is shown), or null when outdoors.
  const [inside, setInside] = useState<string | null>(
    game.state.asleep_since && hasInterior(game.state.location_kind) ? game.state.location_kind : null
  );
  const [pending, setPending] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"wallet" | "notifications" | null>(null);

  // Social: who is around, what is happening, who you are looking at.
  const [people, setPeople] = useState<Person[]>([]);
  const [feed, setFeed] = useState<FeedLine[]>([]);
  const [effects, setEffects] = useState<Record<string, Effect>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingInteraction, setPendingInteraction] = useState<string | null>(null);
  const [chat, setChat] = useState("");
  const [muted, setMuted] = useState(false);

  // Ads: which one is showing rotates every 30 seconds; views are counted once per ad.
  const [adRotation, setAdRotation] = useState(0);
  const [openAd, setOpenAd] = useState<GameAd | null>(null);
  const viewedAds = useRef(new Set<string>());

  // Academics: loaded on start, every 2 minutes (lecture windows open and close), and after each action.
  const [academics, setAcademics] = useState<Academics | null>(null);
  const [showAcademics, setShowAcademics] = useState(false);
  const lastEventId = useRef(0);
  const handled = useRef(new Set<number>());
  const effectKey = useRef(0);
  // Latest chat line from each player here (attached to reports as evidence).
  const [lastMessageFrom, setLastMessageFrom] = useState<Record<string, number>>({});

  const avatar = useMemo(
    () => ({
      skin: game.player.skin,
      hairStyle: game.player.hair_style,
      hairColor: game.player.hair_color,
      outfit: game.player.outfit,
    }),
    [game.player]
  );

  useEffect(() => {
    const first = setTimeout(() => {
      skewRef.current = clockSkew(game.server_time);
      setWebgl(detectWebGL());
      setMuted(readMuted());
      setNow(Date.now() + skewRef.current);
    }, 0);
    // The campus clock and the light move with real time.
    const timer = setInterval(() => setNow(Date.now() + skewRef.current), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [game.server_time]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let live = true;
    const load = () =>
      academicsAction().then((a) => {
        if (live && a) setAcademics(a);
      });
    const first = setTimeout(load, 200);
    const timer = setInterval(load, 120_000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  function refreshAcademics() {
    void academicsAction().then((a) => a && setAcademics(a));
  }

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setAdRotation((r) => r + 1), 30_000);
    return () => clearInterval(t);
  }, [ads.length]);

  function apply(result: ActionResult): boolean {
    if (result.error || !result.dynamic) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return false;
    }
    const d = result.dynamic;
    skewRef.current = clockSkew(d.server_time);
    setDyn(d);
    setNow(Date.parse(d.server_time));
    return true;
  }

  // ---------- Bubbles, poses and the activity log ----------

  function addEffect(id: string, pose: Pose | null, bubble: string, ms: number) {
    const key = ++effectKey.current;
    setEffects((prev) => ({ ...prev, [id]: { pose, bubble, key } }));
    setTimeout(() => {
      setEffects((prev) => {
        if (prev[id]?.key !== key) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, ms);
  }

  function describe(ev: PlaceEvent): string {
    if (ev.kind === "message") return `${ev.actor}: ${ev.body ?? ""}`;
    if (ev.kind === "thrown_out") return `🚪 The bouncers threw ${ev.actor} out!`;
    const it = interactions.find((i) => i.slug === ev.kind);
    return it ? `${it.emoji} ${ev.actor} ${it.verb} ${ev.target ?? "someone"}` : `${ev.actor} did something`;
  }

  function showEvent(ev: PlaceEvent, fresh: boolean) {
    setFeed((prev) => [...prev, { id: ev.id, text: describe(ev) }].slice(-5));
    if (ev.kind === "message") setLastMessageFrom((prev) => ({ ...prev, [ev.actor_id]: ev.id }));
    if (!fresh) return;
    if (ev.kind === "message") {
      addEffect(ev.actor_id, "talk", ev.body ?? "", 6000);
    } else if (ev.kind === "thrown_out") {
      addEffect(ev.actor_id, null, "🚪 Thrown out!", 4000);
    } else {
      const it = interactions.find((i) => i.slug === ev.kind);
      if (it) {
        addEffect(ev.actor_id, it.pose, it.emoji, 4000);
        if (ev.target_id) addEffect(ev.target_id, it.pose === "fight" ? "fight" : null, it.emoji, 4000);
      }
    }
  }

  const onSnapshot = useEffectEvent((snap: WorldSnapshot) => {
    setPeople(snap.people);
    const serverNow = Date.parse(snap.server_time);
    for (const ev of snap.events) {
      lastEventId.current = Math.max(lastEventId.current, ev.id);
      if (handled.current.has(ev.id)) continue;
      handled.current.add(ev.id);
      showEvent(ev, serverNow - Date.parse(ev.at) < 15_000);
    }
  });

  const asleepNow = dyn.state.asleep_since !== null;

  // Ask who is around every few seconds (less often while asleep, never when the tab is hidden).
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      const snap = await snapshotAction(lastEventId.current);
      if (!stopped && snap) onSnapshot(snap);
    }
    const first = setTimeout(poll, 300);
    const timer = setInterval(poll, (asleepNow ? POLL_ASLEEP : POLL_AWAKE) * 1000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [asleepNow]);

  // ---------- Derived state ----------

  const s = dyn.state;
  const asleep = asleepNow;
  const busyUntil = s.busy_until ? Date.parse(s.busy_until) : 0;
  const busySlug = busyUntil > now ? s.busy_activity : null;
  const currentSlug = pending ?? busySlug;
  const current: GameActivity | null = currentSlug
    ? (activities.find((a) => a.slug === currentSlug) ?? academicActivity(currentSlug, s.location_kind))
    : null;
  const occupied = current !== null;

  const here = locations.find((l) => l.kind === s.location_kind) ?? null;
  const zonePlace = locations.find((l) => l.kind === zone) ?? null;
  const atCheckedInPlace = zonePlace !== null && zonePlace.kind === s.location_kind;
  const hereActivities = activities.filter((a) => a.location_kind === s.location_kind);
  // Show a room only while the server agrees the player is there.
  const roomKind = inside !== null && inside === s.location_kind ? inside : null;
  const insidePlace = locations.find((l) => l.kind === roomKind) ?? null;
  const tripEnergy = here && zonePlace ? travelEnergy(here, zonePlace) : 0;
  // You are "at" a place (can chat, see people there) inside its room or standing at its door.
  const atPlace = roomKind !== null || atCheckedInPlace;

  const myEffect = effects[me] ?? null;
  const avatarAction: AvatarAction | null = asleep
    ? "sleep"
    : current
      ? animationFor(current)
      : (myEffect?.pose ?? null);
  const roomSpot: Spot = asleep
    ? BED_SPOT
    : current
      ? spotFor(current.slug, animationFor(current), inside)
      : ENTRY_SPOT;
  const hour = lagosHour(now);
  const night = lightingFor(hour).lamp;

  const herePeople = people.filter((p) => p.location_kind === s.location_kind);

  function poseOf(p: Person, slotPose: Pose | null): Pose {
    const fx = effects[p.id]?.pose;
    if (fx) return fx;
    if (p.asleep) return "sleep";
    const act = p.activity ? activities.find((a) => a.slug === p.activity) : null;
    if (act) return slotPose === "sit" ? "sit" : animationFor(act);
    return slotPose ?? "idle";
  }

  const toAvatar = (p: Person) => ({
    skin: p.skin,
    hairStyle: p.hair_style,
    hairColor: p.hair_color,
    outfit: p.outfit,
  });

  // Outdoors: awake players appear in front of the building they are at.
  const crowd: CrowdMember[] = people
    .filter((p) => !p.asleep)
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: toAvatar(p),
      kind: p.location_kind,
      pose: poseOf(p, null),
      bubble: effects[p.id]?.bubble ?? null,
      friend: p.bond >= 40,
    }));

  // In a room: everyone here gets a spot (sleeping roommates get the other bunks).
  let sleeperIndex = 0;
  let awakeIndex = 0;
  const guests: ShownPerson[] = roomKind
    ? herePeople.map((p) => {
        const spot = p.asleep
          ? guestSpot(roomKind, sleeperIndex++, true)
          : guestSpot(roomKind, awakeIndex++, false);
        return {
          id: p.id,
          name: p.name,
          avatar: toAvatar(p),
          x: spot.x,
          y: spot.y,
          z: spot.z,
          heading: spot.heading,
          pose: poseOf(p, spot.pose),
          bubble: effects[p.id]?.bubble ?? null,
          friend: p.bond >= 40,
        };
      })
    : [];

  const selectedPerson = people.find((p) => p.id === selected) ?? null;
  const placeInteractions: GameInteraction[] = interactions.filter((i) =>
    s.location_kind ? i.place_kinds.includes(s.location_kind) : false
  );

  const ambient: AmbientKind = roomKind
    ? (roomKind as AmbientKind)
    : atCheckedInPlace && (zonePlace?.kind === "sports" || zonePlace?.kind === "market")
      ? (zonePlace.kind as AmbientKind)
      : "outdoor";

  const songs = ads.filter((a) => a.placement === "club_song");
  const song = songs.length ? songs[adRotation % songs.length] : null;
  const products = ads.filter((a) => a.placement === "market_product");
  const atMarket = atCheckedInPlace && zonePlace?.kind === "market";
  const billboardsShowing = ads.filter((a) => a.placement === "billboard");

  // Count an ad as seen when it is actually on screen.
  const showingAdIds = (
    roomKind === "clubhouse"
      ? song
        ? [song.id]
        : []
      : roomKind
        ? []
        : [...billboardsShowing.map((a) => a.id), ...(atMarket ? products.map((a) => a.id) : [])]
  ).join(",");
  useEffect(() => {
    if (!showingAdIds) return;
    for (const id of showingAdIds.split(",")) {
      if (viewedAds.current.has(id)) continue;
      viewedAds.current.add(id);
      void adViewAction(id);
    }
  }, [showingAdIds]);

  const phase = academics?.calendar.phase ?? null;
  const liveMine =
    phase === "lectures" && !academics?.strike ? (academics?.modules.find((m) => m.live_lecture) ?? null) : null;
  const board = academics?.strike
    ? "STRIKE · No lectures"
    : phase === "exams"
      ? "EXAMS IN PROGRESS · Silence"
      : phase === "holiday"
        ? "HOLIDAY · Results are out"
        : liveMine
          ? `${liveMine.code} · ${liveMine.title}`
          : "No lecture right now";

  function doAcademic(kind: "lecture" | "study" | "exam", code: string) {
    setError(null);
    setPending(`${kind}:${code}`);
    startTransition(async () => {
      const fn = kind === "lecture" ? attendLectureAction : kind === "study" ? studyAction : writeExamAction;
      const ok = apply(await fn(code));
      setPending(null);
      if (!ok) return;
      refreshAcademics();
      setToast([
        kind === "lecture" ? `📚 Attended ${code}` : kind === "study" ? `📖 +1 study · ${code}` : `📝 ${code} exam written`,
      ]);
    });
  }

  // ---------- Actions ----------

  function enter() {
    if (!zonePlace) return;
    const kind = zonePlace.kind;
    // Already checked in here: just walk inside, no cost.
    if (atCheckedInPlace) {
      if (hasInterior(kind)) setInside(kind);
      return;
    }
    setError(null);
    setEntering(true);
    startTransition(async () => {
      const result = await travelAction(zonePlace.id);
      const ok = apply(result);
      setEntering(false);
      if (ok && (result.dynamic as { curfew_fine?: boolean } | undefined)?.curfew_fine) {
        setToast(["🚧 Curfew! You paid a gate fine"]);
      }
      if (ok) {
        setFeed([]);
        if (hasInterior(kind)) setInside(kind);
      }
    });
  }

  function doActivity(a: GameActivity) {
    setError(null);
    setPending(a.slug);
    startTransition(async () => {
      const ok = apply(await performActivityAction(a.slug));
      setPending(null);
      if (!ok || a.ends_day) return;
      const parts: string[] = [];
      if (a.energy_delta) parts.push(`⚡ ${signed(a.energy_delta)}`);
      if (a.health_delta) parts.push(`❤️ ${signed(a.health_delta)}`);
      if (a.happiness_delta) parts.push(`😊 ${signed(a.happiness_delta)}`);
      if (a.cost_kobo) parts.push(`-${formatNaira(a.cost_kobo)}`);
      setToast(parts);
    });
  }

  function wake() {
    setError(null);
    setWaking(true);
    const before = s.energy;
    startTransition(async () => {
      const result = await wakeUpAction();
      setWaking(false);
      if (apply(result) && result.dynamic) {
        const gained = result.dynamic.state.energy - before;
        setToast([gained > 0 ? `Good morning! ⚡ +${gained}` : "Good morning!"]);
      }
    });
  }

  function interact(person: Person, kind: string) {
    setError(null);
    setPendingInteraction(kind);
    startTransition(async () => {
      const result = await interactAction(person.id, kind);
      setPendingInteraction(null);
      if (!result.dynamic) {
        setError(result.error ?? "That did not work.");
        setSelected(null);
        return;
      }
      apply({ dynamic: result.dynamic });
      const it = interactions.find((i) => i.slug === kind);
      const eventId = (result.dynamic as { event_id?: number }).event_id;
      if (eventId) {
        handled.current.add(eventId);
        showEvent(
          {
            id: eventId,
            kind,
            body: null,
            actor_id: me,
            actor: game.player.name,
            target_id: person.id,
            target: person.name,
            at: result.dynamic.server_time,
          },
          true
        );
      }
      setSelected(null);
      if (result.dynamic.thrown_out) {
        setInside(null);
        setFeed([]);
        setToast(["🚪 The bouncers threw you out!"]);
      } else if (it && it.cost_kobo > 0) {
        setToast([`${it.emoji} -${formatNaira(it.cost_kobo)}`]);
      }
    });
  }

  function say() {
    const text = chat.trim();
    if (!text) return;
    setChat("");
    startTransition(async () => {
      const result = await sayAction(text);
      if (result.error || !result.eventId) {
        setError(result.error ?? "Your message was not sent.");
        return;
      }
      handled.current.add(result.eventId);
      showEvent(
        {
          id: result.eventId,
          kind: "message",
          body: text,
          actor_id: me,
          actor: game.player.name,
          target_id: null,
          target: null,
          at: new Date(now).toISOString(),
        },
        true
      );
    });
  }

  function block(person: Person) {
    startTransition(async () => {
      const result = await blockAction(person.id, true);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPeople((prev) => prev.filter((p) => p.id !== person.id));
      setSelected(null);
      setToast([`🚫 ${person.name} blocked`]);
    });
  }

  async function report(person: Person, reason: string, details: string): Promise<string | null> {
    const result = await reportAction({
      targetId: person.id,
      reason,
      details,
      eventId: lastMessageFrom[person.id] ?? null,
    });
    return result.error ?? null;
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem("cl_sound", next ? "off" : "on");
    } catch {
      // Storage blocked: the setting just won't be remembered.
    }
  }

  function canDo(a: GameActivity): string | null {
    const ready = dyn.cooldowns[a.slug] ? Date.parse(dyn.cooldowns[a.slug]) : 0;
    if (ready > now) return `Ready in ${formatDuration(ready - now)}`;
    if (!a.ends_day && a.energy_delta < 0 && s.energy < -a.energy_delta) return "Too tired";
    if (dyn.balance_kobo < a.cost_kobo) return "Can't afford";
    return null;
  }

  const activityList =
    hereActivities.length === 0 ? (
      <p className="mt-2 text-sm text-zinc-400">Nothing to do here yet.</p>
    ) : (
      <div className="mt-3 flex max-h-[30vh] gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
        {hereActivities.map((a) => {
          const blocked = canDo(a);
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => doActivity(a)}
              disabled={occupied || blocked !== null}
              className="w-44 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 disabled:opacity-40 active:scale-95 sm:w-auto"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold leading-tight">{a.name}</p>
                {a.cost_kobo > 0 && (
                  <span className="text-xs font-bold text-emerald-300">{formatNaira(a.cost_kobo)}</span>
                )}
              </div>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-zinc-300">
                <span>
                  ⏱ {a.ends_day ? "until you wake" : formatDuration(Number(a.duration_minutes) * 60_000)}
                </span>
                {!a.ends_day && a.energy_delta !== 0 && <span>⚡{signed(a.energy_delta)}</span>}
                {a.health_delta !== 0 && !a.ends_day && <span>❤️{signed(a.health_delta)}</span>}
                {a.happiness_delta !== 0 && !a.ends_day && <span>😊{signed(a.happiness_delta)}</span>}
              </p>
              {blocked && <p className="mt-1 text-[11px] text-amber-300">{blocked}</p>}
            </button>
          );
        })}
      </div>
    );

  const nextOfMine = academics
    ? academics.modules
        .map((m) => ({ m, at: nextLectureStart(m.slots, now) }))
        .filter((x): x is { m: (typeof academics.modules)[number]; at: number } => x.at !== null && !x.m.live_lecture)
        .sort((a, b) => a.at - b.at)[0]
    : undefined;

  const academicBlock =
    academics && roomKind && ["faculty", "library", "hostel"].includes(roomKind) && academics.registered ? (
      <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-[0.15em] text-sky-300">📚 {phaseLabel(academics).toUpperCase()}</p>
          <button type="button" onClick={() => setShowAcademics(true)} className="text-xs text-sky-300 underline">
            Timetable & results
          </button>
        </div>
        {roomKind === "faculty" && phase === "lectures" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {academics.modules.filter((m) => m.live_lecture).length === 0 ? (
              <p className="text-xs text-zinc-300">
                No lecture of yours right now.
                {nextOfMine &&
                  ` Next: ${nextOfMine.m.code} ${slotLabel(nextOfMine.m.slots.find((sl) => nextLectureStart([sl], now) === nextOfMine.at) ?? nextOfMine.m.slots[0])} (in ${formatDuration(nextOfMine.at - now)})`}
              </p>
            ) : (
              academics.modules
                .filter((m) => m.live_lecture)
                .map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => doAcademic("lecture", m.code)}
                    disabled={occupied || m.attended_live || Boolean(academics.strike)}
                    className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-bold text-black disabled:opacity-40"
                  >
                    {m.attended_live ? `✅ ${m.code} attended` : `Attend ${m.code} lecture`}
                  </button>
                ))
            )}
          </div>
        )}
        {roomKind === "faculty" && phase === "exams" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {academics.modules.filter((m) => !m.exam_written).length === 0 ? (
              <p className="text-xs text-zinc-300">All exams written. Results come out when exam week ends.</p>
            ) : (
              academics.modules
                .filter((m) => !m.exam_written)
                .map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => doAcademic("exam", m.code)}
                    disabled={occupied}
                    className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40"
                  >
                    📝 Write {m.code}
                  </button>
                ))
            )}
          </div>
        )}
        {(roomKind === "library" || roomKind === "hostel") && phase !== "holiday" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {academics.modules
              .filter((m) => !m.exam_written && m.study_points < 10)
              .map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => doAcademic("study", m.code)}
                  disabled={occupied}
                  className="rounded-xl border border-sky-400/40 px-3 py-2 text-xs font-bold text-sky-200 disabled:opacity-40"
                >
                  📖 Study {m.code} ({m.study_points}/10)
                </button>
              ))}
          </div>
        )}
        {phase === "holiday" && (
          <p className="mt-2 text-xs text-zinc-300">Holiday. Check your results in Timetable & results.</p>
        )}
      </div>
    ) : null;

  // Who is here, what just happened, and a box to say something.
  const socialBlock = atPlace ? (
    <div className="mt-3 border-t border-white/10 pt-3">
      {herePeople.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {herePeople.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold hover:bg-white/10"
            >
              {p.asleep ? "😴 " : p.bond >= 40 ? "💚 " : p.bond <= -10 ? "😠 " : ""}
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Nobody else is here right now.</p>
      )}
      {feed.length > 0 && (
        <div className="mt-2 space-y-0.5 text-xs text-zinc-300">
          {feed.map((f) => (
            <p key={f.id} className="truncate">
              {f.text}
            </p>
          ))}
        </div>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          say();
        }}
      >
        <input
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          maxLength={140}
          placeholder="Say something to everyone here..."
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none focus:border-amber-400"
        />
        <button
          type="submit"
          disabled={!chat.trim()}
          className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40"
        >
          Say
        </button>
      </form>
    </div>
  ) : null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#0b1020] text-white">
      <AmbientSound kind={ambient} night={night} muted={muted || asleep} />

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
            avatar={avatar}
            spot={roomSpot}
            hour={hour}
            primary={university.primary_color}
            secondary={university.secondary_color}
            guests={guests}
            selfBubble={myEffect?.bubble ?? null}
            selfPose={current || asleep ? null : (myEffect?.pose ?? null)}
            onSelectPerson={setSelected}
            song={song}
            board={board}
          />
        ) : webgl ? (
          <CampusWorld
            locations={locations}
            primary={university.primary_color}
            secondary={university.secondary_color}
            hour={hour}
            avatar={avatar}
            playerName={game.player.name}
            spawnKind={s.location_kind}
            spawnKey="campus"
            action={avatarAction}
            onZoneChange={setZone}
            crowd={crowd}
            selfBubble={myEffect?.bubble ?? null}
            onSelectPerson={setSelected}
            ads={ads}
            adRotation={adRotation}
            onSelectAd={setOpenAd}
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
              <p className="text-sm font-extrabold">{game.player.name}</p>
              <p className="text-[11px] text-zinc-300">
                {enrollment.level_year}00L · {enrollment.course}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-black/45 px-3 py-2 text-right leading-tight backdrop-blur">
                <p className="text-lg font-black tabular-nums">{formatClock(hour)}</p>
                <p className="text-[11px] text-zinc-300">{lagosDateLabel(now)} · WAT</p>
              </div>
              <button
                type="button"
                onClick={() => setPanel("notifications")}
                aria-label={dyn.unread ? `${dyn.unread} new notifications` : "Notifications"}
                className="pointer-events-auto relative rounded-2xl bg-black/45 px-3 py-3 text-lg backdrop-blur"
              >
                🔔
                {dyn.unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold">
                    {dyn.unread > 9 ? "9+" : dyn.unread}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Turn sound on" : "Turn sound off"}
                className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-sm backdrop-blur"
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                onClick={() => setPanel("wallet")}
                className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 text-sm font-extrabold text-emerald-300 backdrop-blur"
              >
                {formatNaira(dyn.balance_kobo)} ›
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2 inline-flex flex-col gap-1 rounded-2xl bg-black/45 px-3 py-2 backdrop-blur">
          <MiniMeter icon="⚡" value={s.energy} color="#fbbf24" />
          <MiniMeter icon="❤️" value={s.health} color="#f87171" />
          <MiniMeter icon="😊" value={s.happiness} color="#e879f9" />
          <p className="text-[11px] text-zinc-400">👥 {people.length} online on campus</p>
          {academics && (
            <button
              type="button"
              onClick={() => setShowAcademics(true)}
              className="pointer-events-auto mt-0.5 text-left text-[11px] font-semibold text-sky-300"
            >
              📚 {phaseLabel(academics)}
              {academics.cgpa !== null && ` · CGPA ${Number(academics.cgpa).toFixed(2)}`}
            </button>
          )}
        </div>

        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto absolute right-3 top-28 w-48 space-y-1 rounded-2xl border border-white/10 bg-[#10172e]/95 p-2 text-sm backdrop-blur sm:right-4"
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
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setShowAcademics(true);
                }}
                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-white/10"
              >
                📚 Academics
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

      {/* activity in progress (real time) */}
      {!asleep && current && (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 flex justify-center">
          {busySlug ? (
            <BusyBar
              label={current.name}
              untilMs={busyUntil}
              totalMs={Number(current.duration_minutes) * 60_000}
              skewRef={skewRef}
              onDone={() => setNow(Date.now() + skewRef.current)}
            />
          ) : (
            <div className="rounded-2xl bg-black/60 px-4 py-3 text-sm font-bold backdrop-blur">
              {current.name}...
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {asleep && s.asleep_since && (
          <SleepOverlay
            asleepSince={s.asleep_since}
            energy={s.energy}
            skewRef={skewRef}
            waking={waking}
            error={error}
            onWake={wake}
          />
        )}
      </AnimatePresence>

      {/* context panel at the bottom */}
      {!asleep && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <div className="pointer-events-auto mx-auto max-h-[60dvh] max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1020]/85 p-4 backdrop-blur">
            {error && (
              <p className="mb-3 rounded-xl bg-red-500/15 p-2 text-center text-sm text-red-200">{error}</p>
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
                    disabled={occupied}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Leave
                  </button>
                </div>
                {roomKind === "clubhouse" && (
                  <button
                    type="button"
                    onClick={() => song && setOpenAd(song)}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl bg-fuchsia-500/10 px-3 py-2 text-left text-sm"
                  >
                    <span className="text-lg">🎵</span>
                    <span className="min-w-0 flex-1 truncate">
                      Now playing:{" "}
                      <span className="font-bold">
                        {song ? `${song.headline}${song.subline ? " · " + song.subline : ""}` : "Campus Life Radio"}
                      </span>
                    </span>
                    {song && <span className="text-[10px] text-zinc-400">Sponsored</span>}
                  </button>
                )}
                {academicBlock}
                {activityList}
                {socialBlock}
              </>
            ) : zonePlace && atCheckedInPlace && !hasInterior(zonePlace.kind) ? (
              <>
                <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">YOU ARE AT</p>
                <p className="text-lg font-extrabold">{zonePlace.name}</p>
                {atMarket && products.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-zinc-400">Featured at the market · Sponsored</p>
                    <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                      {products.map((ad) => (
                        <button
                          key={ad.id}
                          type="button"
                          onClick={() => setOpenAd(ad)}
                          className="w-40 shrink-0 rounded-xl p-3 text-left"
                          style={{ backgroundColor: ad.bg_color, color: ad.fg_color }}
                        >
                          <p className="truncate text-sm font-extrabold">{ad.headline}</p>
                          {ad.price_text && <p className="text-xs font-bold">{ad.price_text}</p>}
                          <p className="truncate text-[10px] opacity-80">{ad.advertiser}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activityList}
                {socialBlock}
              </>
            ) : zonePlace ? (
              <>
                <p className="text-lg font-extrabold">{zonePlace.name}</p>
                <p className="text-sm text-zinc-400">{zonePlace.description}</p>
                {people.some((p) => p.location_kind === zonePlace.kind) && (
                  <p className="mt-1 text-xs text-emerald-300">
                    👥 {people.filter((p) => p.location_kind === zonePlace.kind).length} here now
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={enter}
                    disabled={entering || occupied || (!atCheckedInPlace && s.energy < tripEnergy)}
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
                  {!atCheckedInPlace && <p className="text-xs text-zinc-300">⚡ -{tripEnergy}</p>}
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-zinc-300">
                {here ? (
                  <>
                    Checked in at <span className="font-bold text-white">{here.name}</span>. Walk to
                    any glowing circle to go somewhere.
                  </>
                ) : (
                  "Walk to any glowing circle to go somewhere."
                )}
                <span className="mt-1 block text-xs text-zinc-500">
                  WASD or arrow keys to walk (Shift to run) · tap the ground, a building or a person
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      {selectedPerson && (
        <PlayerCard
          person={selectedPerson}
          placeName={selectedPerson.location_kind === s.location_kind ? (here?.name ?? null) : null}
          interactions={placeInteractions}
          blockedReason={
            selectedPerson.location_kind !== s.location_kind
              ? `${selectedPerson.name} is at another place. Go there to meet them.`
              : !atPlace
                ? `Go to ${here?.name ?? "the same place"} to meet ${selectedPerson.name}.`
                : asleep
                  ? "You are asleep."
                  : occupied
                    ? "Finish what you are doing first."
                    : selectedPerson.asleep
                      ? `${selectedPerson.name} is asleep.`
                      : null
          }
          pendingKind={pendingInteraction}
          canReportMessage={selectedPerson.id in lastMessageFrom}
          onInteract={(kind) => interact(selectedPerson, kind)}
          onBlock={() => block(selectedPerson)}
          onReport={(reason, details) => report(selectedPerson, reason, details)}
          onClose={() => setSelected(null)}
        />
      )}

      {openAd && <AdCard ad={openAd} onClose={() => setOpenAd(null)} />}
      {showAcademics && (
        <AcademicsPanel academics={academics} nowMs={now} onClose={() => setShowAcademics(false)} />
      )}

      {panel === "wallet" && (
        <WalletPanel
          balance={dyn.balance_kobo}
          onClose={() => setPanel(null)}
          onSent={() => startTransition(async () => void apply(await refreshGameAction()))}
        />
      )}
      {panel === "notifications" && (
        <NotificationsPanel
          onClose={() => setPanel(null)}
          onOpened={() => setDyn((d) => ({ ...d, unread: 0 }))}
        />
      )}
    </main>
  );
}
