"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic, WorldSnapshot } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

// Every social action is ONE database call that checks the account, the place,
// blocks, cooldowns and rate limits. The browser never decides any of that.

const ERRORS: Record<string, string> = {
  "not here": "They are not here any more.",
  "they are asleep": "They are asleep. Let them rest.",
  "not allowed here": "You cannot do that here.",
  cooldown: "You just did that with them. Give it a moment.",
  "too tired": "You are too tired for that.",
  "not enough money": "You cannot afford that right now.",
  busy: "Finish what you are doing first.",
  asleep: "You are asleep.",
  "bad message": "Messages must be 1 to 140 characters.",
  "slow down": "Slow down a little.",
  "not yourself": "You cannot do that to yourself.",
  blocked: "This account cannot play right now.",
};

function friendly(fn: string, message: string): string {
  const known = Object.keys(ERRORS).find((k) => message.includes(k));
  if (known) return ERRORS[known];
  console.error(`${fn} failed:`, message);
  return "Something went wrong. Please try again.";
}

const uuid = z.string().uuid();

/** Who is around and what happened here since the last event we saw. */
export async function snapshotAction(since: number): Promise<WorldSnapshot | null> {
  const userId = await requirePlayerId();
  const s = z.number().int().min(0).safeParse(since);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("world_snapshot", {
    p_user_id: userId,
    p_since: s.success ? s.data : 0,
  });
  if (error) {
    if (!error.message.includes("slow down")) console.error("world_snapshot failed:", error.message);
    return null;
  }
  return data as WorldSnapshot;
}

export async function interactAction(
  targetId: string,
  kind: string
): Promise<{ dynamic?: GameDynamic & { thrown_out?: boolean }; error?: string }> {
  const userId = await requirePlayerId();
  const t = uuid.safeParse(targetId);
  const k = z.string().regex(/^[a-z_]{2,30}$/).safeParse(kind);
  if (!t.success || !k.success) return { error: "That is not possible." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("social_interact", {
    p_user_id: userId,
    p_target: t.data,
    p_kind: k.data,
  });
  if (error) return { error: friendly("social_interact", error.message) };
  return { dynamic: data as GameDynamic & { thrown_out?: boolean } };
}

export async function sayAction(text: string): Promise<{ eventId?: number; error?: string }> {
  const userId = await requirePlayerId();
  const parsed = z.string().trim().min(1).max(140).safeParse(text);
  if (!parsed.success) return { error: ERRORS["bad message"] };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("say_in_place", { p_user_id: userId, p_text: parsed.data });
  if (error) return { error: friendly("say_in_place", error.message) };
  return { eventId: (data as { event_id: number }).event_id };
}

export async function blockAction(targetId: string, block: boolean): Promise<{ error?: string }> {
  const userId = await requirePlayerId();
  const t = uuid.safeParse(targetId);
  if (!t.success) return { error: "That is not possible." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("block_player", {
    p_user_id: userId,
    p_target: t.data,
    p_block: block,
  });
  if (error) return { error: friendly("block_player", error.message) };
  return {};
}

export async function blockedListAction(): Promise<{ id: string; name: string }[]> {
  const userId = await requirePlayerId();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_blocked", { p_user_id: userId });
  if (error) {
    console.error("list_blocked failed:", error.message);
    return [];
  }
  return (data ?? []) as { id: string; name: string }[];
}

const reportSchema = z.object({
  targetId: z.string().uuid(),
  reason: z.enum(["harassment", "hate", "spam", "cheating", "inappropriate", "other"]),
  details: z.string().trim().max(300),
  eventId: z.number().int().positive().nullable(),
});

export async function reportAction(input: {
  targetId: string;
  reason: string;
  details: string;
  eventId: number | null;
}): Promise<{ error?: string }> {
  const userId = await requirePlayerId();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "Please pick a reason." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("report_player", {
    p_user_id: userId,
    p_target: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
    p_event_id: parsed.data.eventId,
  });
  if (error) return { error: friendly("report_player", error.message) };
  return {};
}
