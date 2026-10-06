import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ExamQuestion = {
  position: number;
  prompt: string;
  options: string[];
  chosen: number | null;
};

export type ExamData = {
  expires_at: string;
  submitted: boolean;
  questions: ExamQuestion[];
};

export async function startOrResumeExam(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("start_or_resume_exam", { p_user_id: userId });
  if (error) {
    console.error("start_or_resume_exam failed:", error.message);
    return null;
  }
  return data as string;
}

export async function getExam(userId: string, attemptId: string): Promise<ExamData | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_exam", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) {
    console.error("get_exam failed:", error.message);
    return null;
  }
  return data as ExamData;
}

export async function finishExam(userId: string, attemptId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("finish_exam", {
    p_user_id: userId,
    p_attempt_id: attemptId,
  });
  if (error) console.error("finish_exam failed:", error.message);
}

/** True when the given time has already passed. Kept here so pages stay pure. */
export function hasPassed(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}