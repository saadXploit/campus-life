import { describe, expect, it } from "vitest";
import { appearanceOf, carOf, type ItemInfo } from "./shop";

const items: ItemInfo[] = [
  { slug: "car_bmw", category: "car", slot: "car", name: "BMW", seats: 4, look: { color: "#1d4ed8", model: "sedan" } },
  { slug: "outfit_agbada", category: "outfit", slot: "outfit", name: "Agbada", seats: 0, look: { shirt: "#f5f5f4", trousers: "#f5f5f4", robe: "#1d4ed8" } },
  { slug: "look_shades", category: "look", slot: "glasses", name: "Shades", seats: 0, look: { glasses: "#0a0a0a" } },
  { slug: "tag_gold", category: "status", slot: "tag", name: "Gold tag", seats: 0, look: { tag: "#facc15" } },
];

describe("what people wear", () => {
  it("combines everything someone has on", () => {
    const a = appearanceOf({ outfit: "outfit_agbada", glasses: "look_shades", tag: "tag_gold", car: "car_bmw" }, items);
    expect(a.robe).toBe("#1d4ed8");
    expect(a.glasses).toBe("#0a0a0a");
    expect(a.tag).toBe("#facc15");
    // A car is driven, not worn.
    expect((a as Record<string, unknown>).color).toBeUndefined();
  });

  it("is plain for players with nothing bought, or unknown items", () => {
    expect(appearanceOf(undefined, items)).toEqual({});
    expect(appearanceOf({ outfit: "outfit_unknown" }, items)).toEqual({});
  });

  it("finds the car someone drives", () => {
    expect(carOf({ car: "car_bmw" }, items)?.seats).toBe(4);
    expect(carOf({ outfit: "outfit_agbada" }, items)).toBeNull();
    expect(carOf({ car: "outfit_agbada" }, items)).toBeNull();
  });
});
