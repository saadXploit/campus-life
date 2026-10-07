import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { getMyPlayer } from "@/lib/game/player";
import { ensureToday, getMyState } from "@/lib/game/state";
import { createClient } from "@/lib/supabase/server";
import CampusMap, { type MapLocation } from "./CampusMap";

export default async function CampusPage() {
  const user = await requireUser();

  if (!(await getMyPlayer())) redirect("/create");
  const enrollment = await getMyEnrollment();
  if (!enrollment) redirect("/welcome");

  await ensureToday(user.id);

  const supabase = await createClient();
  const [state, locationsResult] = await Promise.all([
    getMyState(),
    supabase
      .from("locations")
      .select("id, name, kind, description, map_x, map_y, has_billboard")
      .eq("university_id", enrollment.university_id)
      .order("name"),
  ]);
  if (!state) redirect("/welcome");

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 pb-40 pt-6 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/home" className="text-sm text-zinc-400 hover:text-white">
          Back
        </Link>
        <p className="mt-5 text-xs font-semibold tracking-[0.3em] text-amber-400">CAMPUS MAP</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">
          {enrollment.universities.name}
        </h1>

        <div className="mt-3 flex gap-3 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1">
            ⏱ {state.hours_left} hours left
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1">⚡ {state.energy}% energy</span>
        </div>

        <div className="mt-5">
          <CampusMap
            locations={(locationsResult.data ?? []) as MapLocation[]}
            currentKind={state.locations?.kind ?? null}
            hoursLeft={state.hours_left}
            energy={state.energy}
            primary={enrollment.universities.primary_color}
            secondary={enrollment.universities.secondary_color}
          />
        </div>
      </div>
    </main>
  );
}