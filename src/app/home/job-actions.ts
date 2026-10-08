"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./actions";

// One database call each. The database checks the place, the hours, the requirements,
// the daily shift limit and the rate limit, and decides the pay.

const ERRORS: Record<string, string> = {
  "job: quit first": "You already have a job. Quit it first (one job at a time).",
  "job: wait": "You changed jobs recently. Wait a day before taking a new one.",
  "job: level too low": "You are not in a high enough level for this job yet.",
  "job: cgpa too low": "Your CGPA is not high enough for this job yet.",
  "job: too young": "You are too young for this job.",
  "job: none": "You don't have a job yet.",
  "job: closed": "This job is not taking shifts right now.",
  "job: enough today": "You have worked enough shifts today. Rest and come back tomorrow.",
  "boss not in": "The boss is not in. Come back during working hours.",
  "unknown job": "That job does not exist.",
  "too tired": "You are too tired to work. Eat something or rest first.",
  "wrong place": "Go to the workplace first.",
  busy: "You are in the middle of something. Wait for it to finish.",
  asleep: "You are asleep. Wake up first.",
  "slow down": "Slow down a little and try again.",
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

export async function applyJobAction(slug: string): Promise<ActionResult> {
  const userId = await requirePlayerId();
  const parsed = z.string().regex(/^[a-z0-9_]{2,40}$/).safeParse(slug);
  if (!parsed.success) return { error: "That job does not exist." };
  return call("apply_job", { p_user_id: userId, p_job: parsed.data });
}

export async function quitJobAction(): Promise<ActionResult> {
  const userId = await requirePlayerId();
  return call("quit_job", { p_user_id: userId });
}

export async function startShiftAction(): Promise<ActionResult> {
  const userId = await requirePlayerId();
  return call("start_shift", { p_user_id: userId });
}
