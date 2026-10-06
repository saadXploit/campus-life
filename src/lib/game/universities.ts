import "server-only";
import { createClient } from "@/lib/supabase/server";

export type University = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  type: "federal" | "state" | "private";
  tagline: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  difficulty: number;
  reputation: number;
  tuition_per_semester_kobo: number;
  party_level: number;
  hustle_level: number;
  student_population: number;
};

export type FacultyWithCourses = {
  id: string;
  name: string;
  departments: {
    id: string;
    name: string;
    courses: { id: string; name: string; code: string; duration_years: number }[];
  }[];
};

export const TYPE_LABEL: Record<University["type"], string> = {
  federal: "Federal",
  state: "State",
  private: "Private",
};

/** A friendly hint only. The real entry scores stay on the server. */
export function competitiveness(difficulty: number): string {
  if (difficulty >= 8) return "Very competitive";
  if (difficulty >= 6) return "Competitive";
  return "More open";
}

const COLUMNS =
  "id, slug, name, short_name, type, tagline, description, primary_color, secondary_color, difficulty, reputation, tuition_per_semester_kobo, party_level, hustle_level, student_population";

export async function listUniversities(): Promise<University[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("universities")
    .select(COLUMNS)
    .order("reputation", { ascending: false });
  return (data ?? []) as University[];
}

export async function getUniversity(
  slug: string
): Promise<{ university: University; faculties: FacultyWithCourses[] } | null> {
  const supabase = await createClient();

  const { data: university } = await supabase
    .from("universities")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (!university) return null;

  const { data: faculties } = await supabase
    .from("faculties")
    .select("id, name, departments(id, name, courses(id, name, code, duration_years))")
    .eq("university_id", university.id)
    .order("name");

  return {
    university: university as University,
    faculties: (faculties ?? []) as unknown as FacultyWithCourses[],
  };
}