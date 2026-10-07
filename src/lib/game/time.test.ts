import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, lagosDateLabel, lagosHour } from "./time";

describe("real Nigerian time", () => {
  it("is one hour ahead of UTC", () => {
    expect(lagosHour(Date.UTC(2026, 9, 8, 20, 30))).toBe(21.5);
    expect(lagosHour(Date.UTC(2026, 9, 8, 23, 0))).toBe(0);
  });

  it("formats the clock", () => {
    expect(formatClock(21.5)).toBe("9:30 PM");
    expect(formatClock(0)).toBe("12:00 AM");
  });

  it("names the Lagos date, not the UTC one", () => {
    // 23:30 UTC on the 7th is already 00:30 on the 8th in Lagos.
    expect(lagosDateLabel(Date.UTC(2026, 9, 7, 23, 30))).toBe("Thursday 8 Oct");
  });

  it("formats durations", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(3 * 60_000)).toBe("3m");
    expect(formatDuration(80 * 60_000)).toBe("1h 20m");
  });
});
