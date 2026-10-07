export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** The player's own clock: it starts at the day's first hour and moves as hours are spent. */
export function clockHourFrom(dayStartHour: number, hoursPerDay: number, hoursLeft: number): number {
  return dayStartHour + (hoursPerDay - hoursLeft);
}

export function formatClock(hour: number): string {
  const total = Math.round(hour * 60);
  const h24 = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function greeting(hour: number): string {
  if (hour < 12) return "GOOD MORNING";
  if (hour < 17) return "GOOD AFTERNOON";
  if (hour < 21) return "GOOD EVENING";
  return "GOOD NIGHT";
}

export function skyGradient(hour: number): string {
  if (hour < 8) return "linear-gradient(160deg, #7c3aed55, #f59e0b44 60%, #0b1020)";
  if (hour < 16) return "linear-gradient(160deg, #0ea5e955, #38bdf844 60%, #0b1020)";
  if (hour < 20) return "linear-gradient(160deg, #f9731655, #a855f744 60%, #0b1020)";
  return "linear-gradient(160deg, #1e1b4b99, #0b1020)";
}