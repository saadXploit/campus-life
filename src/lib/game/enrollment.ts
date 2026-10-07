import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Enrollment = {
  level_year: number;
  university_id: string;
  universities: {
    name: string;
    short_name: string;
    primary_color: string;
    secondary_color: string;
  };
  courses: { name: string };
};

export async function getMyEnrollment(): Promise<Enrollment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(
      "level_year, university_id, universities(name, short_name, primary_color, secondary_color), courses(name)"
    )
    .eq("status", "active")
    .maybeSingle();
  return (data as unknown as Enrollment | null) ?? null;
}