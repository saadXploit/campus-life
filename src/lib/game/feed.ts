/**
 * Fetches data the game screen checks repeatedly, from /api/game/<feed>.
 * These run alongside the player's own actions instead of queueing in front of them.
 * Returns null on any failure (the next check simply tries again).
 */
export async function fetchFeed<T>(feed: "snapshot" | "badges" | "academics" | "messages", params: Record<string, string | number | null> = {}): Promise<T | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) qs.set(k, String(v));
  try {
    const res = await fetch(`/api/game/${feed}${qs.size ? `?${qs}` : ""}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}
