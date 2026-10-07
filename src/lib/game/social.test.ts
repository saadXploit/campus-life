import { describe, expect, it } from "vitest";
import { bondLabel } from "./social";

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
