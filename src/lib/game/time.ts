/**
 * The game runs on real Nigerian time (West Africa Time, UTC+1, no daylight saving),
 * the same for every player.
 */

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** Hour of the day in Lagos, with minutes as a fraction (21.5 = 9:30 PM). */
export function lagosHour(ms: number): number {
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function formatClock(hour: number): string {
  const total = Math.round(hour * 60);
  const h24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** e.g. "Wednesday 8 Oct". */
export function lagosDateLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

/** "45s", "3m", "1h 20m". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
