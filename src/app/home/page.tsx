import { redirect } from "next/navigation";
import RefreshButton from "@/components/RefreshButton";
import { requireUser } from "@/lib/auth/guards";
import { listActivities } from "@/lib/game/activities";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { getMyPlayer } from "@/lib/game/player";
import { ensureToday, getMyState } from "@/lib/game/state";
import { WEEKDAYS, clockHourFrom } from "@/lib/game/time";
import { getWorld } from "@/lib/game/world";
import { createClient } from "@/lib/supabase/server";
import GameClient, { type GameLocation } from "./GameClient";

export default async function HomePage() {
  const user = await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");
  const enrollment = await getMyEnrollment();
  if (!enrollment) redirect("/welcome");

  await ensureToday(user.id);

  const supabase = await createClient();
  const [state, world, walletResult, activities, locationsResult, unreadResult] = await Promise.all([
    getMyState(),
    getWorld(),
    supabase.from("wallets").select("balance_kobo").eq("player_id", player.id).maybeSingle(),
    listActivities(),
    supabase
      .from("locations")
      .select("id, name, kind, description, map_x, map_y, has_billboard")
      .eq("university_id", enrollment.university_id),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  // Not a redirect: /welcome sends enrolled students here, so that would loop.
  if (!state || !world) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b1020] p-6 text-center text-white">
        <p className="font-bold">Your campus could not load right now.</p>
        <RefreshButton>Try again</RefreshButton>
      </main>
    );
  }

  const hour = clockHourFrom(world.dayStartHour, world.hoursPerDay, state.hours_left);
  // The player can be up to one day ahead of the shared calendar (after waking up early).
  const playerDay = Math.max(state.day_number, world.dayNumber);

  return (
    <GameClient
      playerName={player.display_name}
      avatar={{
        skin: player.avatar_skin,
        hairStyle: player.avatar_hair_style,
        hairColor: player.avatar_hair_color,
        outfit: player.avatar_outfit,
      }}
      university={enrollment.universities}
      levelYear={enrollment.level_year}
      courseName={enrollment.courses.name}
      locations={(locationsResult.data ?? []) as GameLocation[]}
      activities={activities}
      state={{
        energy: state.energy,
        health: state.health,
        happiness: state.happiness,
        hours_left: state.hours_left,
        slept_today: state.slept_today,
        locationKind: state.locations?.kind ?? null,
      }}
      world={{
        dayNumber: playerDay,
        weekday: WEEKDAYS[(playerDay - 1) % 7],
        nextDayAt: world.nextDayAt,
      }}
      hour={hour}
      balance={walletResult.data?.balance_kobo ?? 0}
      unreadCount={unreadResult.count ?? 0}
      canWake={state.day_number <= world.dayNumber}
    />
  );
}
