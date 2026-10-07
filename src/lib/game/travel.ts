type Point = { map_x: number; map_y: number };

/** Energy to walk between two buildings. For display only: the server recalculates it. */
export function travelEnergy(from: Point, to: Point): number {
  const distance = Math.hypot(from.map_x - to.map_x, from.map_y - to.map_y);
  return Math.max(1, Math.ceil(distance / 25));
}
