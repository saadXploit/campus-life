import { describe, expect, it } from "vitest";
import {
  RING,
  campusRoads,
  entranceOf,
  footprintOf,
  mainGate,
  placeCarParks,
  toWorld,
  type Box,
} from "./worldLayout";

// The campus layout from the database: State is mirrored left-right, Private flipped top-bottom.
const BASE: [string, number, number][] = [
  ["hostel", 15, 70],
  ["faculty", 50, 30],
  ["library", 75, 25],
  ["cafeteria", 40, 60],
  ["market", 85, 75],
  ["sports", 20, 25],
  ["clubhouse", 62, 52],
  ["health", 45, 85],
];

function campus(type: "federal" | "state" | "private") {
  return BASE.map(([kind, mx, my]) => {
    const { x, z } = toWorld(type === "state" ? 100 - mx : mx, type === "private" ? 100 - my : my);
    return { kind, x, z, entrance: entranceOf(kind, x, z) };
  });
}

function distance(px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz));
}

describe.each(["federal", "state", "private"] as const)("roads on a %s campus", (type) => {
  const placed = campus(type);
  const roads = campusRoads(placed);

  it("has a ring road and a road out of the main gate", () => {
    expect(roads).toHaveLength(5);
    const gate = roads[4];
    expect(gate.from).toEqual(placed.find((p) => p.kind === "market")!.entrance);
    expect(Math.max(Math.abs(gate.to.x), Math.abs(gate.to.z))).toBe(RING);
    expect(mainGate(roads)).not.toBeNull();
  });

  it("never runs a road through a building", () => {
    for (const r of roads) {
      for (const p of placed) {
        const f = footprintOf(p.kind);
        if (!f.solid) continue;
        for (let t = 0; t <= 1; t += 0.01) {
          const x = r.from.x + (r.to.x - r.from.x) * t;
          const z = r.from.z + (r.to.z - r.from.z) * t;
          const inside = Math.abs(x - p.x) < f.w / 2 + r.width / 2 && Math.abs(z - p.z) < f.d / 2 + r.width / 2;
          expect(inside).toBe(false);
        }
      }
    }
  });

  it("finds room for a car park by the gate and by the Faculty Block", () => {
    const blockers: Box[] = placed.map((p) => {
      const f = footprintOf(p.kind);
      return { minX: p.x - f.w / 2 - 2, maxX: p.x + f.w / 2 + 2, minZ: p.z - f.d / 2 - 2, maxZ: p.z + f.d / 2 + 2 };
    });
    const targets = ["market", "faculty"].map((k) => placed.find((p) => p.kind === k)!.entrance);
    const parks = placeCarParks(targets, blockers, roads);
    expect(parks).toHaveLength(2);
    for (const k of parks) {
      expect(Math.abs(k.x) + k.w / 2).toBeLessThan(RING - 3);
      expect(Math.abs(k.z) + k.d / 2).toBeLessThan(RING - 3);
      for (const r of roads) expect(distance(k.x, k.z, r.from, r.to)).toBeGreaterThan(r.width / 2);
      expect(k.cars.length).toBeGreaterThan(0);
      expect(k.cars.length).toBeLessThanOrEqual(10);
    }
    expect(placeCarParks(targets, blockers, roads)).toEqual(parks);
  });
});
