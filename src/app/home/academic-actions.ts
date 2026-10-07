"use server";

import { z } from "zod";
import { requirePlayerId } from "@/lib/auth/guards";
import type { Academics } from "@/lib/game/academics";
import type { GameDynamic } from "@/lib/game/gameTypes";
import { createAdminClient } from "@/lib/supabase/admin";

const ERRORS: Record<string, string> = {
  "go to the faculty": "Go to the Faculty Block for that.",
  "study at the library or hostel": "Study at the library or at your hostel desk.",
  "no lectures now": "There are no lectures right now.",
  "no lecture now": "That course has no lecture on right now.",
  "already attended": "You already attended this lecture.",
  "not your course": "That is not one of your courses this semester.",
  strike: "Lecturers are on strike. No lectures today.",
  "not exam week": "Exams have not started yet.",
  "exam already written": "You already wrote that exam.",
  "fully prepared": "You are fully prepared for that course.",
  holiday: "It is the holiday. Rest, the next semester is coming.",
  "too tired": "You are too tired. Eat or rest first.",
  busy: "Finish what you are doing first.",
  asleep: "You are asleep.",
  "slow down": "Slow down a little.",
  blocked: "This account cannot play right now.",
};

function friendly(fn: string, message: string): string {
  const known = Object.keys(ERRORS).find((k) => message.includes(k));
  if (known) return ERRORS[known];
  console.error(`${fn} failed:`, message);
  return "Something went wrong. Please try again.";
}

const code = z.string().regex(/^[A-Z]{3}[0-9]{3}$/);

export async function academicsAction(): Promise<Academics | null> {
  const userId = await requirePlayerId();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_academics", { p_user_id: userId });
  if (error) {
    console.error("get_academics failed:", error.message);
    return null;
  }
  return data as Academics;
}

async function run(fn: string, moduleCode: string): Promise<{ dynamic?: GameDynamic; error?: string }> {
  const userId = await requirePlayerId();
  const parsed = code.safeParse(moduleCode);
  if (!parsed.success) return { error: "That course does not exist." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(fn, { p_user_id: userId, p_code: parsed.data });
  if (error) return { error: friendly(fn, error.message) };
  return { dynamic: data as GameDynamic };
}

export async function attendLectureAction(moduleCode: string) {
  return run("attend_lecture", moduleCode);
}

export async function studyAction(moduleCode: string) {
  return run("study_module", moduleCode);
}

export async function writeExamAction(moduleCode: string) {
  return run("write_exam", moduleCode);
}
