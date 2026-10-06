"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { finishExam } from "@/lib/game/exam";
import { createAdminClient } from "@/lib/supabase/admin";

const answerSchema = z.object({
  attemptId: z.string().uuid(),
  position: z.number().int().min(1).max(10),
  chosen: z.number().int().min(0).max(3),
});

/** Saves one answer. No IP rate limit here on purpose: a whole campus can share one address. */
export async function saveAnswerAction(
  attemptId: string,
  position: number,
  chosen: number
): Promise<void> {
  const user = await requireUser();
  const parsed = answerSchema.safeParse({ attemptId, position, chosen });
  if (!parsed.success) return;

  const admin = createAdminClient();
  const { error } = await admin.rpc("save_exam_answer", {
    p_user_id: user.id,
    p_attempt_id: parsed.data.attemptId,
    p_position: parsed.data.position,
    p_chosen: parsed.data.chosen,
  });
  if (error) console.error("save_exam_answer failed:", error.message);
}

export async function finishExamAction(attemptId: string): Promise<void> {
  const user = await requireUser();
  const parsed = z.string().uuid().safeParse(attemptId);
  if (parsed.success) await finishExam(user.id, parsed.data);
  redirect("/apply/status");
}