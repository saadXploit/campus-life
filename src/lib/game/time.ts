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
