/**
 * Jobs: what the player sees about them. The database decides who is hired, when a
 * shift can start and what it pays; these helpers only explain it on screen.
 */

export type GameJob = {
  slug: string;
  name: string;
  description: string;
  location_kind: string;
  boss_name: string;
  boss_title: string;
  /** Trainee pay for one shift, after the admin pay setting. */
  pay_kobo: number;
  shift_minutes: number;
  energy_cost: number;
  happiness_delta: number;
  /** Nigerian time. A closing hour at or before the opening hour runs past midnight. */
  open_hour: number;
  close_hour: number;
  min_level: number;
  min_cgpa: number | null;
  min_age: number;
};

export type PlayerJob = {
  slug: string | null;
  shifts_done: number;
  rank: number;
  /** What your next shift pays (rank raise included). */
  pay_kobo: number | null;
  shifts_today: number;
  daily_limit: number;
  /** When you may take a different job after quitting. */
  can_change_at: string;
  last_pay: {
    id: number;
    job: string;
    pay_kobo: number;
    bonus_kobo: number;
    boss_line: string | null;
    paid_at: string;
  } | null;
};

export function jobOpen(open: number, close: number, hour: number): boolean {
  return close > open ? hour >= open && hour < close : hour >= open || hour < close;
}

function hourLabel(h: number): string {
  const x = ((h % 24) + 24) % 24;
  if (x === 0) return "12am";
  if (x === 12) return "12pm";
  return x < 12 ? `${x}am` : `${x - 12}pm`;
}

export function hoursLabel(open: number, close: number): string {
  if (open === close % 24) return "Open all day";
  return `${hourLabel(open)} – ${hourLabel(close)}`;
}

/** "work:pos_agent" → "pos_agent". */
export function workBusy(slug: string): string | null {
  return slug.startsWith("work:") ? slug.slice(5) : null;
}

export const RANK_NAMES = ["", "Trainee", "Staff", "Senior"];

/** Shifts needed for each raise, matching the database (10 → Staff +25%, 30 → Senior +50%). */
export function nextRaise(shiftsDone: number): { at: number; name: string } | null {
  if (shiftsDone < 10) return { at: 10, name: "Staff (+25% pay)" };
  if (shiftsDone < 30) return { at: 30, name: "Senior (+50% pay)" };
  return null;
}

export function requirementText(job: GameJob): string | null {
  const parts: string[] = [];
  if (job.min_level > 1) parts.push(`${job.min_level}00 level+`);
  if (job.min_cgpa !== null) parts.push(`CGPA ${Number(job.min_cgpa).toFixed(2)}+`);
  if (job.min_age > 16) parts.push(`${job.min_age}+`);
  return parts.length ? parts.join(" · ") : null;
}

/** Why this player cannot take the job yet, or null when they qualify. */
export function notEligible(
  job: GameJob,
  me: { level: number; cgpa: number | null; age: number | null }
): string | null {
  if (me.level < job.min_level) return `Needs ${job.min_level}00 level`;
  if (job.min_cgpa !== null && (me.cgpa ?? 0) < Number(job.min_cgpa)) {
    return `Needs a CGPA of ${Number(job.min_cgpa).toFixed(2)}`;
  }
  if (me.age !== null && me.age < job.min_age) return `Only for ${job.min_age}+`;
  return null;
}
