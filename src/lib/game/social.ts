/** How two players feel about each other, from -100 (enemies) to 100 (close friends). */
export function bondLabel(bond: number): string {
  if (bond >= 70) return "Close friend";
  if (bond >= 40) return "Friend";
  if (bond >= 10) return "Mate";
  if (bond > -10) return "Stranger";
  if (bond > -40) return "Rival";
  return "Enemy";
}

export const REPORT_REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or insults about who someone is" },
  { value: "inappropriate", label: "Sexual or inappropriate" },
  { value: "spam", label: "Spam or scams" },
  { value: "cheating", label: "Cheating or exploiting" },
  { value: "other", label: "Something else" },
] as const;
