import { describe, expect, it } from "vitest";
import {
  PLAYER_RADIUS,
  WORLD_HALF,
  entranceOf,
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
