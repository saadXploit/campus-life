import { getMyEnrollment } from "@/lib/game/enrollment";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMyOpenApplication } from "@/lib/game/applications";
import { getMyPlayer } from "@/lib/game/player";
import {
  INTEREST_FACULTY,
  listCourseCatalog,
  listUniversities,
} from "@/lib/game/universities";
import ApplyWizard from "./ApplyWizard";

export default async function ApplyPage() {
  await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");
    if (await getMyEnrollment()) redirect("/welcome");
  if (await getMyOpenApplication()) redirect("/apply/status");

  const [catalog, universities] = await Promise.all([listCourseCatalog(), listUniversities()]);

  return (
    <ApplyWizard
      catalog={catalog}
      universities={universities.map((u) => ({
        id: u.id,
        name: u.name,
        short_name: u.short_name,
        type: u.type,
        primary_color: u.primary_color,
        secondary_color: u.secondary_color,
        tuition_per_semester_kobo: u.tuition_per_semester_kobo,
        difficulty: u.difficulty,
      }))}
      recommendedFaculty={INTEREST_FACULTY[player.interest] ?? null}
    />
  );
}