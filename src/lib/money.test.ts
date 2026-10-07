import { describe, expect, it } from "vitest";
import { formatNaira, parseNairaToKobo } from "./money";

describe("money", () => {
  it("formats kobo as naira", () => {
    expect(formatNaira(1500000)).toBe("₦15,000");
  });

  it("reads typed amounts", () => {
    expect(parseNairaToKobo("5000")).toBe(500000);
    expect(parseNairaToKobo("5,000")).toBe(500000);
    expect(parseNairaToKobo(" ₦20,000 ")).toBe(2000000);
  });

  it("refuses anything that is not a positive whole naira amount", () => {
    for (const bad of ["", "0", "-50", "12.5", "abc", "1e5", "9999999999"]) {
      expect(parseNairaToKobo(bad)).toBeNull();
    }
  });
});
