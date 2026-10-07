"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

// Each action is ONE database call. The database checks the account is active,
// applies the rate limit and returns the fresh game state, so the screen never reloads.

export type ActionResult = { dynamic?: GameDynamic; error?: string };

const ERRORS: Record<string, string> = {
  "too tired": "You are too tired for that. Eat something or rest first.",
  "not enough money": "You cannot afford that right now.",
  "wrong place": "You need to be at the right place for that.",
  busy: "You are in the middle of something. Wait for it to finish.",
  asleep: "You are asleep. Wake up first.",
  cooldown: "You did that recently. Try again a bit later.",
  "slow down": "Slow down a little and try again.",
  "unknown location": "That place does not exist.",
  blocked: "This account cannot play right now.",
};

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (known) return { error: ERRORS[known] };
    console.error(`${fn} failed:`, error.message);
    return { error: "Something went wrong. Please try again." };
  }
  return { dynamic: data as GameDynamic };
}

export async function performActivityAction(slug: string): Promise<ActionResult> {
  const userId = await requirePlayerId();
  const parsed = z.string().regex(/^[a-z0-9_]{2,40}$/).safeParse(slug);
  if (!parsed.success) return { error: "That activity does not exist." };
  return call("perform_activity", { p_user_id: userId, p_activity: parsed.data });
}

export async function travelAction(locationId: string): Promise<ActionResult> {
  const userId = await requirePlayerId();
  const parsed = z.string().uuid().safeParse(locationId);
  if (!parsed.success) return { error: "That place does not exist." };
  return call("travel_to", { p_user_id: userId, p_location_id: parsed.data });
}

export async function wakeUpAction(): Promise<ActionResult> {
  const userId = await requirePlayerId();
  return call("wake_up", { p_user_id: userId });
}

/** Fresh money, stats and notification count (after sending money, for example). */
export async function refreshGameAction(): Promise<ActionResult> {
  const userId = await requirePlayerId();
  return call("get_game_dynamic", { p_user_id: userId });
}
