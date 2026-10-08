/**
 * The mini-map: where you and your friends are on campus.
 * Uses the campus map grid (0-100) that every location already has, so it needs no extra
 * data from the server. Pure helpers, shared by the mini-map and its tests.
 */

import { WORLD_SCALE } from "./worldLayout";
import { workBusy } from "./jobs";
import { academicBusy } from "./academics";

/** A position in the 3D world, as a point on the 0-100 campus map. */
export function worldToMap(x: number, z: number): { mx: number; my: number } {
  return {
    mx: Math.max(0, Math.min(100, x / WORLD_SCALE + 50)),
    my: Math.max(0, Math.min(100, z / WORLD_SCALE + 50)),
  };
}

/** Spreads several dots at the same place in a small ring so they don't sit on top of each other. */
export function spread(index: number, count: number, radius = 3.2): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  const a = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(a) * radius, dy: Math.sin(a) * radius };
}

/** What a friend is doing, in a few words. */
export function doingLabel(p: { asleep: boolean; activity: string | null }, activityName: (slug: string) => string | null): string {
  if (p.asleep) return "😴 Sleeping";
  const a = p.activity;
  if (!a) return "Hanging around";
  const study = academicBusy(a);
  if (study) {
    return study.kind === "lecture" ? `📚 In a ${study.code} lecture` : study.kind === "exam" ? `📝 Writing ${study.code}` : `📖 Studying ${study.code}`;
  }
  if (workBusy(a)) return "💼 At work";
  return activityName(a) ?? "Busy";
}

/** Map pin colour and emoji for each kind of place. */
export const PLACE_ICONS: Record<string, string> = {
  hostel: "🛏️",
  faculty: "🏛️",
  library: "📚",
  cafeteria: "🍛",
  market: "🛒",
  sports: "⚽",
  clubhouse: "🎵",
  health: "🏥",
};
