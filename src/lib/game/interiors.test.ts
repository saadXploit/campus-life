import { describe, expect, it } from "vitest";
import { ACTIVITY_SPOTS, BED_SPOT, ROOM, guestSpot, hasInterior, spotFor } from "./interiors";

describe("interiors", () => {
  it("has rooms for buildings but not for the field or market", () => {
    expect(hasInterior("hostel")).toBe(true);
    expect(hasInterior("library")).toBe(true);
    expect(hasInterior("sports")).toBe(false);
    expect(hasInterior("market")).toBe(false);
    expect(hasInterior(null)).toBe(false);
  });

  it("sleeps in the bunk, not on the floor", () => {
    expect(spotFor("sleep", "idle")).toBe(BED_SPOT);
    expect(BED_SPOT.y).toBeGreaterThan(0.4);
    expect(BED_SPOT.pose).toBe("sleep");
  });

  it("keeps every activity spot inside the room", () => {
    for (const s of Object.values(ACTIVITY_SPOTS)) {
      expect(Math.abs(s.x)).toBeLessThan(ROOM.w / 2);
      expect(Math.abs(s.z)).toBeLessThan(ROOM.d / 2);
    }
  });

  it("uses the middle of the room for unknown activities", () => {
    const s = spotFor("brand_new_activity", "busy");
    expect(s.pose).toBe("busy");
    expect(s.y).toBe(0);
  });
});

describe("other players in a room", () => {
  it("puts sleeping roommates in the other bunks, never yours", () => {
    for (let i = 0; i < 3; i++) {
      const s = guestSpot("hostel", i, true);
      expect(s.pose).toBe("sleep");
      expect(s.x === BED_SPOT.x && s.y === BED_SPOT.y).toBe(false);
    }
  });

  it("always finds a spot inside the room, even for a crowd", () => {
    for (let i = 0; i < 30; i++) {
      const s = guestSpot("clubhouse", i, false);
      expect(Math.abs(s.x)).toBeLessThan(ROOM.w / 2);
      expect(Math.abs(s.z)).toBeLessThan(ROOM.d / 2);
    }
  });
});
