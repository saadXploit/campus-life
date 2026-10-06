import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OpenApplication = {
  id: string;
  status: "exam_pending" | "exam_in_progress" | "awaiting_result" | "decided";
  exam_opens_at: string;
  result_ready_at: string | null;
  application_choices: {
    rank: number;
    universities: {
      name: string;
      short_name: string;
      slug: string;
      primary_color: string;
      secondary_color: string;
      tuition_per_semester_kobo: number;
    };
    courses: { name: string; code: string };
  }[];
};

/** The player's current open application, if any. The database only returns their own. */
export async function getMyOpenApplication(): Promise<OpenApplication | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select(
      "id, status, exam_opens_at, result_ready_at, application_choices(rank, universities(name, short_name, slug, primary_color, secondary_color, tuition_per_semester_kobo), courses(name, code))"
    )
    .neq("status", "decided")
    .maybeSingle();

  if (!data) return null;
  const app = data as unknown as OpenApplication;
  app.application_choices.sort((a, b) => a.rank - b.rank);
  return app;
}