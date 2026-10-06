"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest } from "@/lib/rate-limit";

type State = { error: string } | null;

const schema = z.object({
  courseCode: z.string().regex(/^[A-Z]{3}$/, "Please pick a course."),
  universities: z
    .array(z.string().uuid())
    .min(1, "Pick at least one university.")
    .max(3, "Pick at most three universities.")
    .refine((a) => new Set(a).size === a.length, "Each university can only be chosen once."),
});

export async function submitApplicationAction(
  _previous: State,
  formData: FormData
): Promise<State> {
  const user = await requireUser();

  if (!(await allowRequest("apply", 10, 600))) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const parsed = schema.safeParse({
    courseCode: formData.get("courseCode"),
    universities: formData.getAll("university").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your choices." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_application", {
    p_user_id: user.id,
    p_course_code: parsed.data.courseCode,
    p_university_ids: parsed.data.universities,
  });

  if (error) {
    if (error.message.includes("applications_one_open")) redirect("/apply/status");
    if (error.message.includes("no character")) redirect("/create");
    if (error.message.includes("course not offered")) {
      return { error: "That course is not offered at one of your choices." };
    }
    console.error("submit_application failed:", error.message);
    return { error: "Could not submit your application. Please try again." };
  }

  redirect("/apply/status");
}