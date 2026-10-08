/**
 * Shop items and how they look. Real money only buys items, never game naira.
 * Pure data and helpers, shared by the shop screen and the 3D drawing.
 */

export type ItemLook = {
  color?: string;
  model?: "sedan" | "suv";
  shirt?: string;
  trousers?: string;
  robe?: string;
  glasses?: string;
  chain?: string;
  cap?: string;
  shoes?: string;
  tag?: string;
  item?: string;
};

export type ShopItem = {
  slug: string;
  category: "car" | "ride" | "outfit" | "look" | "room" | "move" | "social" | "status";
  slot: string | null;
  name: string;
  description: string;
  price_kobo: number;
  seats: number;
  look: ItemLook;
  available: boolean;
  owned: boolean;
};

export type ShopData = {
  open: boolean;
  adult: boolean;
  age_confirmed: boolean;
  style: Record<string, string>;
  items: ShopItem[];
  purchases: { reference: string; item: string; amount_kobo: number; status: string; created_at: string }[];
};

/** Item looks sent with the game state, so everyone's style can be drawn. */
export type ItemInfo = { slug: string; category: string; slot: string | null; name: string; seats: number; look: ItemLook };

/** What someone is wearing, worked out from the item slugs in their style. */
export type Appearance = {
  shirt?: string;
  trousers?: string;
  robe?: string;
  glasses?: string;
  chain?: string;
  cap?: string;
  shoes?: string;
  tag?: string;
};

export function appearanceOf(style: Record<string, string> | null | undefined, items: ItemInfo[]): Appearance {
  const out: Appearance = {};
  if (!style) return out;
  for (const slot of ["outfit", "cap", "glasses", "chain", "shoes", "tag"]) {
    const slug = style[slot];
    const look = slug ? items.find((i) => i.slug === slug)?.look : undefined;
    if (look) Object.assign(out, { ...look, color: undefined, model: undefined, item: undefined });
  }
  return out;
}

/** The car someone drives, if any. */
export function carOf(style: Record<string, string> | null | undefined, items: ItemInfo[]): ItemInfo | null {
  const slug = style?.car;
  return (slug && items.find((i) => i.slug === slug && i.category === "car")) || null;
}

export const CATEGORY_LABELS: Record<ShopItem["category"], string> = {
  car: "🚗 Cars",
  outfit: "👕 Outfits",
  look: "🕶️ Looks",
  room: "🛏️ Room",
  status: "✨ Status",
  ride: "🛵 Rides",
  move: "💃 Moves",
  social: "🎉 Social",
};
