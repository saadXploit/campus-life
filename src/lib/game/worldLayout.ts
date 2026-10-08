/**
 * How the campus map (0-100 grid stored in the database) becomes a 3D world.
 * Pure maths, no rendering, so it can be tested and reused by any client.
 * X runs left-right, Z runs top-bottom (map_y), Y is up.
 */

export const WORLD_SCALE = 1.6;
export const WORLD_HALF = 100;
export const PLAYER_RADIUS = 0.45;
export const ZONE_RADIUS = 3.2;

export type Footprint = { w: number; d: number; h: number; solid: boolean };

/** Building size per kind. Sports fields and markets are open ground you can walk onto. */
export const FOOTPRINTS: Record<string, Footprint> = {
  hostel: { w: 18, d: 9, h: 9, solid: true },
  faculty: { w: 20, d: 12, h: 10, solid: true },
  library: { w: 14, d: 12, h: 8, solid: true },
  cafeteria: { w: 14, d: 9, h: 4.5, solid: true },
  market: { w: 16, d: 9, h: 3.2, solid: false },
  sports: { w: 30, d: 18, h: 0.2, solid: false },
  clubhouse: { w: 13, d: 10, h: 6, solid: true },
  health: { w: 12, d: 9, h: 5, solid: true },
};

const DEFAULT_FOOTPRINT: Footprint = { w: 10, d: 8, h: 5, solid: true };

export function footprintOf(kind: string): Footprint {
  return FOOTPRINTS[kind] ?? DEFAULT_FOOTPRINT;
}

export function toWorld(mapX: number, mapY: number): { x: number; z: number } {
  return { x: (mapX - 50) * WORLD_SCALE, z: (mapY - 50) * WORLD_SCALE };
}

/** The glowing circle in front of each building (always on the side facing the camera). */
export function entranceOf(kind: string, x: number, z: number): { x: number; z: number } {
  const f = footprintOf(kind);
  return { x, z: z + f.d / 2 + 3.5 };
}

export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

export function obstacleOf(kind: string, x: number, z: number): Box | null {
  const f = footprintOf(kind);
  if (!f.solid) return null;
  return { minX: x - f.w / 2, maxX: x + f.w / 2, minZ: z - f.d / 2, maxZ: z + f.d / 2 };
}

/** Pushes a circle out of any box it overlaps, then keeps it inside the campus. */
export function resolveCollision(
  x: number,
  z: number,
  radius: number,
  boxes: Box[]
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const dist2 = dx * dx + dz * dz;
    if (dist2 >= radius * radius) continue;

    if (dist2 > 1e-9) {
      const dist = Math.sqrt(dist2);
      px = cx + (dx / dist) * radius;
      pz = cz + (dz / dist) * radius;
    } else {
      // Centre is inside the box: leave by the nearest side.
      const exits = [
        { d: px - b.minX, x: b.minX - radius, z: pz },
        { d: b.maxX - px, x: b.maxX + radius, z: pz },
        { d: pz - b.minZ, x: px, z: b.minZ - radius },
        { d: b.maxZ - pz, x: px, z: b.maxZ + radius },
      ].sort((a, c) => a.d - c.d);
      px = exits[0].x;
      pz = exits[0].z;
    }
  }
  const edge = WORLD_HALF - 2;
  return { x: Math.max(-edge, Math.min(edge, px)), z: Math.max(-edge, Math.min(edge, pz)) };
}

/** Small, repeatable random numbers so every player sees the same trees. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// ---------- The faculty district ----------

export type FacultyHall = { name: string; x: number; z: number; w: number; d: number; h: number };

const HALL = { w: 9, d: 7, h: 6 };

function boxesOverlap(a: Box, b: Box): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function segmentDistance(px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

/**
 * Places one building per faculty around the main Faculty Block, never on top of
 * another building, a billboard or a path, and never in front of the entrance.
 * Faculties that do not fit are simply not drawn (the Faculty Block still works).
 */
export function placeFacultyHalls(
  hub: { x: number; z: number },
  faculties: string[],
  blockers: Box[],
  paths: { from: { x: number; z: number }; to: { x: number; z: number } }[]
): FacultyHall[] {
  const out: FacultyHall[] = [];
  const taken: Box[] = [...blockers];
  const edge = WORLD_HALF - 6;
  for (const name of faculties) {
    let placed = false;
    for (const radius of [19, 27, 35, 43, 51]) {
      for (let step = 0; step < 24 && !placed; step++) {
        // Start behind the building (-z) and work round both sides. Close in, the front
        // (where the entrance is) stays clear; further out it is fine.
        const angle = Math.PI + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * (Math.PI / 12);
        const front = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
        if (front < Math.PI / 3 && radius < 27) continue;
        const x = hub.x + Math.sin(angle) * radius;
        const z = hub.z + Math.cos(angle) * radius;
        if (Math.abs(x) > edge || Math.abs(z) > edge) continue;
        const box: Box = {
          minX: x - HALL.w / 2 - 2,
          maxX: x + HALL.w / 2 + 2,
          minZ: z - HALL.d / 2 - 2,
          maxZ: z + HALL.d / 2 + 2,
        };
        if (taken.some((b) => boxesOverlap(box, b))) continue;
        if (paths.some((p) => segmentDistance(x, z, p.from, p.to) < HALL.w / 2 + 3.5)) continue;
        taken.push(box);
        out.push({ name, x, z, ...HALL });
        placed = true;
      }
      if (placed) break;
    }
  }
  return out;
}

// ---------- Roads and car parks ----------

/** The ring road runs round the campus at this distance from the centre. */
export const RING = 76;
export const ROAD_WIDTH = 7;

export type Road = { from: { x: number; z: number }; to: { x: number; z: number }; width: number };

/**
 * A ring road round the whole campus and a road from the Market Gate (the main gate)
 * out to it. Buildings sit inside the ring, so the roads never cross them.
 */
export function campusRoads(placed: { kind: string; entrance: { x: number; z: number } }[]): Road[] {
  const r = RING;
  const corners = [
    { x: -r, z: -r },
    { x: r, z: -r },
    { x: r, z: r },
    { x: -r, z: r },
  ];
  const roads: Road[] = corners.map((c, i) => ({ from: c, to: corners[(i + 1) % 4], width: ROAD_WIDTH }));
  const gate = placed.find((p) => p.kind === "market");
  if (gate) {
    const e = gate.entrance;
    // Straight out to whichever side of the ring is closest.
    const options = [
      { d: r - e.x, to: { x: r, z: e.z } },
      { d: e.x + r, to: { x: -r, z: e.z } },
      { d: r - e.z, to: { x: e.x, z: r } },
      { d: e.z + r, to: { x: e.x, z: -r } },
    ].sort((a, b) => a.d - b.d);
    roads.push({ from: e, to: options[0].to, width: ROAD_WIDTH - 1 });
  }
  return roads;
}

/** The main gate arch, on the gate road just before it meets the ring road. */
export function mainGate(roads: Road[]): { x: number; z: number; across: boolean } | null {
  const g = roads[4];
  if (!g) return null;
  // A little way up the gate road, clear of the ring road traffic.
  const len = Math.hypot(g.to.x - g.from.x, g.to.z - g.from.z) || 1;
  const back = Math.min(ROAD_WIDTH, len / 2);
  return {
    x: g.to.x - ((g.to.x - g.from.x) / len) * back,
    z: g.to.z - ((g.to.z - g.from.z) / len) * back,
    across: Math.abs(g.to.x) === RING,
  };
}

export type ParkedCar = { x: number; z: number; heading: number; color: number };
export type CarPark = { x: number; z: number; w: number; d: number; cars: ParkedCar[] };

const PARK = { w: 16, d: 10 };

/**
 * One car park near each target (the main gate and the Faculty Block), never on a
 * building, a path or a road. Some bays have parked cars; the rest stay free for
 * players' own cars later.
 */
export function placeCarParks(
  targets: { x: number; z: number }[],
  blockers: Box[],
  segments: { from: { x: number; z: number }; to: { x: number; z: number }; width?: number }[]
): CarPark[] {
  const out: CarPark[] = [];
  const taken = [...blockers];
  const edge = RING - ROAD_WIDTH - PARK.w / 2;
  targets.forEach((t, n) => {
    for (const radius of [13, 17, 22, 28, 34]) {
      for (let step = 0; step < 16; step++) {
        const a = (step / 16) * Math.PI * 2;
        const x = t.x + Math.sin(a) * radius;
        const z = t.z + Math.cos(a) * radius;
        if (Math.abs(x) > edge || Math.abs(z) > edge) continue;
        const box: Box = { minX: x - PARK.w / 2 - 1.5, maxX: x + PARK.w / 2 + 1.5, minZ: z - PARK.d / 2 - 1.5, maxZ: z + PARK.d / 2 + 1.5 };
        if (taken.some((b) => boxesOverlap(box, b))) continue;
        const clear = segments.every((sg) => {
          const half = (sg.width ?? 3) / 2 + 1;
          const pts = [
            [x, z],
            [box.minX, box.minZ],
            [box.maxX, box.minZ],
            [box.minX, box.maxZ],
            [box.maxX, box.maxZ],
            [x, box.minZ],
            [x, box.maxZ],
            [box.minX, z],
            [box.maxX, z],
          ];
          return pts.every(([px, pz]) => segmentDistance(px, pz, sg.from, sg.to) > half);
        });
        if (!clear) continue;
        taken.push(box);
        const rand = seededRandom(97 + n * 31);
        const cars: ParkedCar[] = [];
        for (let i = 0; i < 5; i++) {
          for (const row of [-1, 1]) {
            if (rand() < 0.45) continue;
            cars.push({ x: x - 6 + i * 3, z: z + row * 2.6, heading: row < 0 ? 0 : Math.PI, color: Math.floor(rand() * 8) });
          }
        }
        out.push({ x, z, ...PARK, cars });
        return;
      }
    }
  });
  return out;
}
