import { describe, expect, it } from "vitest";
import { doingLabel, spread, worldToMap } from "./minimap";
import { toWorld } from "./worldLayout";

describe("mini-map", () => {
  it("puts a world position back on the campus map", () => {
    const w = toWorld(85, 75);
    const m = worldToMap(w.x, w.z);
    expect(m.mx).toBeCloseTo(85);
    expect(m.my).toBeCloseTo(75);
  });

  it("keeps positions on the map edges", () => {
    expect(worldToMap(10_000, -10_000)).toEqual({ mx: 100, my: 0 });
  });

  it("spreads friends at the same place apart", () => {
    expect(spread(0, 1)).toEqual({ dx: 0, dy: 0 });
    const a = spread(0, 3);
    const b = spread(1, 3);
    expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThan(2);
  });

  it("says what a friend is doing", () => {
    const name = (slug: string) => (slug === "cafeteria_meal" ? "Cafeteria meal" : null);
    expect(doingLabel({ asleep: true, activity: null }, name)).toBe("😴 Sleeping");
    expect(doingLabel({ asleep: false, activity: "lecture:CSC111" }, name)).toBe("📚 In a CSC111 lecture");
    expect(doingLabel({ asleep: false, activity: "work:pos_agent" }, name)).toBe("💼 At work");
    expect(doingLabel({ asleep: false, activity: "cafeteria_meal" }, name)).toBe("Cafeteria meal");
    expect(doingLabel({ asleep: false, activity: null }, name)).toBe("Hanging around");
  });
});
