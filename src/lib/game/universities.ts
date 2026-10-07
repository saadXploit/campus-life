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

/** How each kind of university feels to play. Matches the rules on the server. */
export const TYPE_PERKS: Record<University["type"], string[]> = {
  federal: ["Lowest fees", "Big, crowded classes", "Lecturers can go on strike"],
  state: ["Moderate fees", "Friendly, local feel", "Strikes are possible"],
  private: [
    "Highest fees",
    "Small classes: a small boost in exams",
    "Curfew 11 PM to 5 AM: ₦2,000 gate fine to leave the hostel",
    "No strikes",
  ],
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
export const INTEREST_FACULTY: Record<string, string> = {
  science: "Faculty of Science",
  engineering: "Faculty of Engineering",
  health: "Faculty of Health Sciences",
  social: "Faculty of Social Sciences",
  arts: "Faculty of Arts",
  law: "Faculty of Law",
  management: "Faculty of Management Sciences",
};

export type CatalogCourse = { code: string; name: string; duration_years: number };

/** Every distinct course, grouped by faculty (each university offers the same list). */
export async function listCourseCatalog(): Promise<
  { faculty: string; courses: CatalogCourse[] }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faculties")
    .select("name, departments(courses(code, name, duration_years))");

  const grouped = new Map<string, Map<string, CatalogCourse>>();
  const rows = (data ?? []) as unknown as {
    name: string;
    departments: { courses: CatalogCourse[] }[];
  }[];

  for (const f of rows) {
    const inner = grouped.get(f.name) ?? new Map<string, CatalogCourse>();
    for (const d of f.departments) {
      for (const c of d.courses) inner.set(c.code, c);
    }
    grouped.set(f.name, inner);
  }

  return [...grouped.entries()]
    .map(([faculty, courses]) => ({ faculty, courses: [...courses.values()] }))
    .sort((a, b) => a.faculty.localeCompare(b.faculty));
}