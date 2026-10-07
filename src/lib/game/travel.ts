type Point = { map_x: number; map_y: number };

/** For display only. The server recalculates the real cost every time. */
export function travelHours(from: Point, to: Point): number {
  const distance = Math.hypot(from.map_x - to.map_x, from.map_y - to.map_y);
  return Math.max(1, Math.ceil(distance / 30)) * 0.25;
}

export function travelCost(hours: number): number {
  return Math.ceil(hours * 2);
}