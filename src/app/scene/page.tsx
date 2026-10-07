import { redirect } from "next/navigation";
import RoomView from "@/components/scene/RoomView";
import { requireUser } from "@/lib/auth/guards";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { getMyPlayer } from "@/lib/game/player";
import { SCENES } from "@/lib/game/scenes";
import { ensureToday, getMyState } from "@/lib/game/state";
import { clockHourFrom, formatClock } from "@/lib/game/time";
import { getWorld } from "@/lib/game/world";

export default async function ScenePage({
  searchParams,
}: {
  searchParams: Promise<{ debug?: string }>;
}) {
  const user = await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");
  if (!(await getMyEnrollment())) redirect("/welcome");

  await ensureToday(user.id);
  const [state, world] = await Promise.all([getMyState(), getWorld()]);
  if (!state || !world) redirect("/welcome");

  const { debug } = await searchParams;
  const hour = clockHourFrom(world.dayStartHour, world.hoursPerDay, state.hours_left);
  const scene = SCENES[state.locations?.kind ?? "hostel"] ?? SCENES.hostel;

  return (
    <RoomView
      scene={scene}
      hour={hour}
      clock={formatClock(hour)}
      debug={debug === "1"}
      avatar={{
        skin: player.avatar_skin,
        hairStyle: player.avatar_hair_style,
        hairColor: player.avatar_hair_color,
        outfit: player.avatar_outfit,
      }}
    />
  );
}