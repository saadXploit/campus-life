import { describe, expect, it } from "vitest";
import { bondLabel, lastSeenLabel } from "./social";

describe("bond labels", () => {
  it("names each range", () => {
    expect(bondLabel(0)).toBe("Stranger");
    expect(bondLabel(12)).toBe("Mate");
    expect(bondLabel(45)).toBe("Friend");
    expect(bondLabel(100)).toBe("Close friend");
    expect(bondLabel(-11)).toBe("Rival");
    expect(bondLabel(-100)).toBe("Enemy");
  });
});

describe("last seen", () => {
  const now = Date.UTC(2026, 9, 8, 12, 0);
  it("says online, minutes, hours or days", () => {
    expect(lastSeenLabel(true, null, now)).toBe("online");
    expect(lastSeenLabel(false, new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(lastSeenLabel(false, new Date(now - 3 * 3600_000).toISOString(), now)).toBe("3h ago");
    expect(lastSeenLabel(false, new Date(now - 2 * 86400_000).toISOString(), now)).toBe("2d ago");
  });
});
