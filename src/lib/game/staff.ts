/**
 * Campus staff: security, porters, cleaners, groundsmen and job bosses.
 * They are characters drawn by the game, never real players. Who is on duty comes
 * from the real Nigerian time alone, so every player sees the same staff, nothing is
 * sent over the network and a crowded campus costs nothing extra.
 */

import { jobOpen, type GameJob } from "./jobs";

export type Uniform = { shirt: string; trousers: string; cap: string | null };

export const UNIFORMS: Record<string, Uniform> = {
  security: { shirt: "#1e3a8a", trousers: "#0f172a", cap: "#0f172a" },
  porter: { shirt: "#92400e", trousers: "#1f2937", cap: null },
  cleaner: { shirt: "#0f766e", trousers: "#134e4a", cap: "#14b8a6" },
  groundsman: { shirt: "#4d7c0f", trousers: "#3f3f46", cap: "#365314" },
  bouncer: { shirt: "#0a0a0a", trousers: "#0a0a0a", cap: null },
};

export type StaffAvatar = { skin: number; hairStyle: number; hairColor: number; outfit: number };

export type StaffMember = {
  id: string;
  name: string;
  title: string;
  /** Uniform key, or null for a boss in their own clothes. */
  uniform: string | null;
  /** The place they work at. */
  kind: string;
  /** Outdoors by the entrance, or inside the room. */
  indoors: boolean;
  /** Spot by the door: 0 right, 1 left, 2 far right, 3 far left. */
  slot: number;
  /** Walks up and down in front of the building. */
  patrol: boolean;
  open: number;
  close: number;
  avatar: StaffAvatar;
  lines: string[];
  /** For bosses: the job they hire for. */
  jobSlug: string | null;
};

function hashCode(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** A fixed look for a staff character, worked out from their name. */
export function staffAvatar(name: string): StaffAvatar {
  const h = hashCode(name);
  return {
    skin: 1 + ((h >>> 3) % 5),
    hairStyle: [0, 5, 1, 2, 3][(h >>> 7) % 5],
    hairColor: [0, 1, 5][(h >>> 11) % 3],
    outfit: (h >>> 13) % 6,
  };
}

type Def = Omit<StaffMember, "avatar" | "jobSlug" | "indoors" | "patrol"> & { patrol?: boolean; indoors?: boolean };

const SECURITY_LINES = [
  "Move along, student. Stay safe.",
  "Carry your ID card at all times.",
  "No loitering after dark.",
  "Report anything strange to security.",
];

const DEFS: Def[] = [
  { id: "gate-day-1", name: "Sgt. Danladi", title: "Security", uniform: "security", kind: "market", slot: 0, open: 6, close: 18, lines: SECURITY_LINES },
  { id: "gate-day-2", name: "Mr. Peter", title: "Security", uniform: "security", kind: "market", slot: 1, open: 6, close: 18, lines: SECURITY_LINES },
  { id: "gate-night", name: "Mallam Garba", title: "Night Security", uniform: "security", kind: "market", slot: 1, open: 18, close: 6, lines: ["The gate is watched all night.", ...SECURITY_LINES] },
  { id: "hostel-night", name: "Mr. Eze", title: "Hostel Security", uniform: "security", kind: "hostel", slot: 1, open: 22, close: 6, lines: ["Lights out soon. Go and sleep.", ...SECURITY_LINES] },
  { id: "faculty-patrol", name: "Cpl. Ibrahim", title: "Security", uniform: "security", kind: "faculty", slot: 1, open: 7, close: 19, patrol: true, lines: ["Lectures are on. Keep the noise down.", ...SECURITY_LINES] },
  { id: "library-guard", name: "Mr. Felix", title: "Security", uniform: "security", kind: "library", slot: 0, open: 8, close: 20, lines: ["Bags stay at the door.", "No food in the library."] },
  { id: "club-bouncer", name: "Big Sam", title: "Bouncer", uniform: "bouncer", kind: "clubhouse", slot: 0, open: 18, close: 3, lines: ["No fighting inside, or you're out.", "Enjoy your night. Behave."] },
  { id: "faculty-cleaner", name: "Mama Rose", title: "Cleaner", uniform: "cleaner", kind: "faculty", slot: 2, open: 6, close: 11, lines: ["Mind the wet floor, my dear.", "Good morning! Read your books o."] },
  { id: "cafeteria-cleaner", name: "Aunty Joy", title: "Cleaner", uniform: "cleaner", kind: "cafeteria", slot: 1, open: 12, close: 17, lines: ["Please put your plate back.", "Keep our cafeteria clean."] },
  { id: "groundsman", name: "Mr. Tanko", title: "Groundsman", uniform: "groundsman", kind: "sports", slot: 1, open: 7, close: 15, lines: ["Don't spoil my grass!", "The pitch is ready for this evening."] },
];

export const CAMPUS_STAFF: StaffMember[] = DEFS.map((d) => ({
  ...d,
  indoors: d.indoors ?? false,
  patrol: d.patrol ?? false,
  avatar: staffAvatar(d.name),
  jobSlug: null,
}));

/** Places where the job boss stands outside the door (the rest work inside). */
const OUTDOOR_JOB_KINDS = ["market", "sports", "hostel"];

/** The boss for a job, as a staff character. */
export function bossFor(job: GameJob): StaffMember {
  return {
    id: `boss-${job.slug}`,
    name: job.boss_name,
    title: job.boss_title,
    uniform: job.location_kind === "hostel" ? "porter" : null,
    kind: job.location_kind,
    indoors: !OUTDOOR_JOB_KINDS.includes(job.location_kind),
    slot: 3,
    patrol: false,
    open: job.open_hour,
    close: job.close_hour,
    avatar: staffAvatar(job.boss_name),
    lines: [`I'm hiring: ${job.name}. Come and work with me.`],
    jobSlug: job.slug,
  };
}

/** Everyone working at this hour (the same list on every device). */
export function staffOnDuty(hour: number, jobs: GameJob[]): StaffMember[] {
  return [...CAMPUS_STAFF, ...jobs.map(bossFor)].filter((s) => jobOpen(s.open, s.close, hour));
}

/** A line the staff member says when tapped, changing every few minutes. */
export function staffLine(s: StaffMember, nowMs: number): string {
  return s.lines[Math.floor(nowMs / 180_000) % s.lines.length];
}
