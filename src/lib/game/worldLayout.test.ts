import { describe, expect, it } from "vitest";
import {
  PLAYER_RADIUS,
  WORLD_HALF,
  entranceOf,
  footprintOf,
  placeFacultyHalls,
  obstacleOf,
  resolveCollision,
  seededRandom,
  toWorld,
} from "./worldLayout";

describe("map to world", () => {
  it("puts the map centre at the world origin", () => {
    expect(toWorld(50, 50)).toEqual({ x: 0, z: 0 });
  });

  it("places entrances outside their building", () => {
    const box = obstacleOf("hostel", 0, 0)!;
    const e = entranceOf("hostel", 0, 0);
    expect(e.z).toBeGreaterThan(box.maxZ);
  });

  it("treats the sports field as walkable ground", () => {
    expect(obstacleOf("sports", 0, 0)).toBeNull();
  });
});

describe("collision", () => {
  const box = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };

  it("leaves a free position alone", () => {
    expect(resolveCollision(10, 10, PLAYER_RADIUS, [box])).toEqual({ x: 10, z: 10 });
  });

  it("pushes a player out of a wall they walked into", () => {
    const p = resolveCollision(5.2, 0, PLAYER_RADIUS, [box]);
    expect(p.x).toBeCloseTo(5 + PLAYER_RADIUS);
    expect(p.z).toBe(0);
  });

  it("gets a player out if they end up inside a building", () => {
    const p = resolveCollision(4.5, 0, PLAYER_RADIUS, [box]);
    expect(p.x).toBeCloseTo(5 + PLAYER_RADIUS);
  });

  it("keeps players inside the campus", () => {
    const p = resolveCollision(500, -500, PLAYER_RADIUS, []);
    expect(p.x).toBeLessThan(WORLD_HALF);
    expect(p.z).toBeGreaterThan(-WORLD_HALF);
  });
});

describe("seeded random", () => {
  it("repeats for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("faculty district", () => {
  const names = ["Faculty of Arts", "Faculty of Law", "Faculty of Science", "Faculty of Engineering"];

  it("places each faculty without overlapping anything", () => {
    const blocker = { minX: 15, maxX: 30, minZ: -10, maxZ: 10 };
    const halls = placeFacultyHalls({ x: 0, z: 0 }, names, [blocker], []);
    expect(halls.length).toBe(4);
    for (const h of halls) {
      const overlapsBlocker =
        h.x - h.w / 2 < blocker.maxX && h.x + h.w / 2 > blocker.minX &&
        h.z - h.d / 2 < blocker.maxZ && h.z + h.d / 2 > blocker.minZ;
      expect(overlapsBlocker).toBe(false);
    }
    for (let i = 0; i < halls.length; i++) {
      for (let j = i + 1; j < halls.length; j++) {
        expect(Math.hypot(halls[i].x - halls[j].x, halls[i].z - halls[j].z)).toBeGreaterThan(8);
      }
    }
  });

  it("keeps the area right in front of the Faculty Block clear", () => {
    for (const h of placeFacultyHalls({ x: 0, z: 0 }, names, [], [])) {
      const inFront = h.z > 0 && Math.abs(h.x) < h.z;
      expect(inFront && Math.hypot(h.x, h.z) < 27).toBe(false);
    }
  });

  it("never builds on a path", () => {
    const path = { from: { x: 0, z: 0 }, to: { x: 0, z: -80 } };
    for (const h of placeFacultyHalls({ x: 0, z: 0 }, names, [], [path])) {
      expect(Math.abs(h.x)).toBeGreaterThan(h.w / 2 + 3);
    }
  });
});

describe("faculty district on the real campus layouts", () => {
  const template: [string, number, number][] = [
    ["hostel", 15, 70], ["faculty", 50, 30], ["library", 75, 25], ["cafeteria", 40, 60],
    ["market", 85, 75], ["sports", 20, 25], ["clubhouse", 62, 52], ["health", 45, 85],
  ];
  const seven = ["Arts", "Engineering", "Health Sciences", "Law", "Management", "Science", "Social Sciences"];

  for (const type of ["federal", "state", "private"] as const) {
    it(`fits all 7 faculties on a ${type} campus`, () => {
      const placed = template.map(([kind, mx, my]) => {
        const { x, z } = toWorld(type === "state" ? 100 - mx : mx, type === "private" ? 100 - my : my);
        return { kind, x, z, entrance: entranceOf(kind, x, z) };
      });
      const blockers = placed.map((p) => {
        const f = footprintOf(p.kind);
        return { minX: p.x - f.w / 2, maxX: p.x + f.w / 2, minZ: p.z - f.d / 2, maxZ: p.z + f.d / 2 };
      });
      const hub = placed.find((p) => p.kind === "faculty")!;
      const paths = placed.filter((p) => p !== hub).map((p) => ({ from: hub.entrance, to: p.entrance }));
      const halls = placeFacultyHalls(hub, seven, blockers, paths);
      expect(halls.length).toBe(7);
    });
  }
});
