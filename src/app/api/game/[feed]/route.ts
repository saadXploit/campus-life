import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Read-only game data the screen checks again and again (who is around, badges,
 * academics, chat messages).
 *
 * These used to be Server Actions, but Next.js runs a player's Server Actions one at a
 * time, so every background check made the player's own taps wait in line. Plain GET
 * requests run side by side, so taps go straight through.
 * Each one is a single database call, which checks the account and the rate limits.
 */

const uuid = z.string().uuid();
const positive = z.coerce.number().int().positive();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ feed: string }> }) {
  // Checks the signed login token locally (no extra round trip to the auth server).
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return json({ error: "signed out" }, 401);

  const { feed } = await params;
  const url = new URL(request.url);
  const admin = createAdminClient();

  let fn: string;
  let args: Record<string, unknown>;
  switch (feed) {
    case "snapshot": {
      const since = z.coerce.number().int().min(0).safeParse(url.searchParams.get("since") ?? 0);
      fn = "world_snapshot";
      args = { p_user_id: userId, p_since: since.success ? since.data : 0 };
      break;
    }
    case "badges":
      fn = "social_badges";
      args = { p_user_id: userId };
      break;
    case "academics":
      fn = "get_academics";
      args = { p_user_id: userId };
      break;
    case "messages": {
      const conversation = uuid.safeParse(url.searchParams.get("c"));
      const after = url.searchParams.get("after");
      const afterId = after ? positive.safeParse(after) : null;
      if (!conversation.success || (afterId && !afterId.success)) return json({ error: "bad request" }, 400);
      fn = "get_messages";
      args = {
        p_user_id: userId,
        p_conversation: conversation.data,
        p_after: afterId?.success ? afterId.data : null,
        p_before: null,
      };
      break;
    }
    default:
      return json({ error: "not found" }, 404);
  }

  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    const quiet = error.message.includes("slow down");
    if (!quiet) console.error(`${fn} failed:`, error.message);
    return json({ error: quiet ? "slow down" : "failed" }, quiet ? 429 : 500);
  }
  return json({ data });
}
