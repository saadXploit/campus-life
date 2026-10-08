"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

// Outings with friends. One database call each; the database checks friendships,
// money, the place and the rate limit.

export type OutingResult = {
  dynamic?: GameDynamic & { outing_kind?: string; paid_by_host?: boolean };
  error?: string;
};

const ERRORS: Record<string, string> = {
  "outing: pick friends": "Pick at least one friend to invite.",
  "outing: too many": "That is too many people for one outing.",
  "outing: no invite": "That invitation is no longer open.",
  "outing: expired": "That invitation has expired.",
  "not friends": "You can only invite your friends.",
  "not enough money": "You don't have enough money to pay for everyone.",
  "too tired": "You are too tired for that right now.",
  cooldown: "You did that recently. Try again a bit later.",
  "wrong place": "You need to be at the right place for that.",
  busy: "You are in the middle of something. Wait for it to finish.",
  asleep: "You are asleep. Wake up first.",
  curfew: "Curfew! The gate is locked and you cannot pay the gate fine.",
  "slow down": "Slow down a little and try again.",
  blocked: "This account cannot play right now.",
};

async function call(fn: string, args: Record<string, unknown>): Promise<OutingResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    const known = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (known) return { error: ERRORS[known] };
    console.error(`${fn} failed:`, error.message);
    return { error: "Something went wrong. Please try again." };
  }
  return { dynamic: data as OutingResult["dynamic"] };
}

const create = z.object({
  activity: z.string().regex(/^[a-z0-9_]{2,40}$/),
  friends: z.array(z.string().uuid()).min(1).max(20),
  hostPays: z.boolean(),
});

export async function createOutingAction(activity: string, friends: string[], hostPays: boolean) {
  const userId = await requirePlayerId();
  const parsed = create.safeParse({ activity, friends, hostPays });
  if (!parsed.success) return { error: "Pick at least one friend to invite." };
  return call("create_outing", {
    p_user_id: userId,
    p_activity: parsed.data.activity,
    p_friends: parsed.data.friends,
    p_host_pays: parsed.data.hostPays,
  });
}

export async function respondOutingAction(outingId: string, accept: boolean) {
  const userId = await requirePlayerId();
  if (!z.string().uuid().safeParse(outingId).success) return { error: "That invitation is no longer open." };
  return call("respond_outing", { p_user_id: userId, p_outing: outingId, p_accept: accept === true });
}
