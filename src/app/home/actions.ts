"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { ensureToday } from "@/lib/game/state";
import { allowRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const ERRORS: Record<string, string> = {
  "not enough time": "You do not have enough hours left today.",
  "too tired": "You are too tired for that. Rest first.",
  "not enough money": "You cannot afford that right now.",
  "wrong place": "You need to be at the right place for that.",
  "already slept": "You have already gone to bed. A new day is coming.",
  "new day pending": "A new day has started. Refresh to continue.",
};

/** Ends sleep and starts the player's next day. */
export async function wakeUpAction(): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!(await allowRequest("wake", 20, 60, { userId: user.id }))) {
    return { error: "Slow down a little and try again." };
  }
  // If the campus day already turned over, this alone wakes them up.
  if (!(await ensureToday(user.id))) return { error: "Could not wake up. Please try again." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("wake_up", { p_user_id: user.id });
  if (error) {
    if (error.message.includes("not asleep")) return {};
    if (error.message.includes("too early")) {
      return { error: "You are a full day ahead. Rest until the campus clock catches up." };
    }
    console.error("wake_up failed:", error.message);
    return { error: "Could not wake up. Please try again." };
  }
  return {};
}

export async function performActivityAction(slug: string): Promise<{ error?: string }> {
  const user = await requireUser();

  const parsed = z.string().regex(/^[a-z0-9_]{2,40}$/).safeParse(slug);
  if (!parsed.success) return { error: "That activity does not exist." };

  if (!(await allowRequest("activity", 60, 60, { userId: user.id }))) {
    return { error: "Slow down a little and try again." };
  }

  if (!(await ensureToday(user.id))) {
    return { error: "Could not start your day. Please try again." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("perform_activity", {
    p_user_id: user.id,
    p_activity: parsed.data,
  });

  if (error) {
    const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (known) return { error: ERRORS[known] };
    console.error("perform_activity failed:", error.message);
    return { error: "Could not do that. Please try again." };
  }

  return {};
}
