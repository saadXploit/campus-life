import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best guess at who is calling. Behind a hosting provider, the first address
 * in x-forwarded-for is set by the provider. On your own computer it is
 * usually empty, so everything shares one "unknown" bucket (fine for testing).
 */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const first = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

/**
 * Counts this request and says whether it is allowed.
 * Pass userId for signed-in actions: the limit is then per player, so students
 * sharing one hostel Wi-Fi or mobile network do not block each other.
 * Without it (sign-in pages), the limit is per IP address.
 * Fails CLOSED: if the counter cannot be reached, the request is refused.
 */
export async function allowRequest(
  name: string,
  limit: number,
  windowSeconds: number,
  options: { userId?: string } = {}
): Promise<boolean> {
  const who = options.userId ? `u:${options.userId}` : `ip:${await getClientIp()}`;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: `${name}:${who}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate limit check failed:", error.message);
    return false;
  }
  return data === true;
}