/** Naija life events and rankings, as returned by the game database. */

export type LifeChoice = {
  key: string;
  label: string;
  /** Kobo: positive comes in, negative goes out. */
  money?: number;
  energy?: number;
  health?: number;
  happiness?: number;
  result: string;
};

export type LifeEvent = {
  id: number;
  slug: string;
  emoji: string;
  title: string;
  body: string;
  choices: LifeChoice[];
};

export type RankRow = { id: string; name: string; value: number; me: boolean };

export type Rankings = {
  richest: RankRow[];
  top_cgpa: RankRow[];
  most_friends: RankRow[];
  me: { balance: number; cgpa: number | null; friends: number; rich_rank: number; cgpa_rank: number | null };
};

/** "+₦8,000 · 😊+5", the effects of a choice in a few symbols. */
export function choiceEffects(c: LifeChoice, naira: (kobo: number) => string): string {
  const parts: string[] = [];
  if (c.money) parts.push(`${c.money > 0 ? "+" : "-"}${naira(Math.abs(c.money))}`);
  if (c.happiness) parts.push(`😊${c.happiness > 0 ? "+" : ""}${c.happiness}`);
  if (c.energy) parts.push(`⚡${c.energy > 0 ? "+" : ""}${c.energy}`);
  if (c.health) parts.push(`❤️${c.health > 0 ? "+" : ""}${c.health}`);
  return parts.join(" · ");
}
