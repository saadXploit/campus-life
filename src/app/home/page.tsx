import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Countdown from "@/components/Countdown";
import Meter from "@/components/Meter";
import RefreshButton from "@/components/RefreshButton";
import UniversityCrest from "@/components/UniversityCrest";
import { requireUser } from "@/lib/auth/guards";
import { getMyEnrollment } from "@/lib/game/enrollment";
import { getMyPlayer } from "@/lib/game/player";
import { ensureToday, getMyState } from "@/lib/game/state";
import { clockHourFrom, formatClock, greeting, skyGradient } from "@/lib/game/time";
import { getWorld } from "@/lib/game/world";
import { formatNaira } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await requireUser();

  const player = await getMyPlayer();
  if (!player) redirect("/create");
  const enrollment = await getMyEnrollment();
  if (!enrollment) redirect("/welcome");

  await ensureToday(user.id);

  const supabase = await createClient();
  const [state, world, walletResult] = await Promise.all([
    getMyState(),
    getWorld(),
    supabase.from("wallets").select("balance_kobo").eq("player_id", player.id).maybeSingle(),
  ]);
  if (!state || !world) redirect("/welcome");

  const hour = clockHourFrom(world.dayStartHour, world.hoursPerDay, state.hours_left);
  const balance = walletResult.data?.balance_kobo;

  return (
    <main className="min-h-screen bg-[#0b1020] pb-12 text-white">
      <header className="px-5 pb-8 pt-6" style={{ background: skyGradient(hour) }}>
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Avatar
              skin={player.avatar_skin}
              hairStyle={player.avatar_hair_style}
              hairColor={player.avatar_hair_color}
              outfit={player.avatar_outfit}
              className="h-14 w-14 rounded-2xl bg-white/10"
            />
            <div className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm font-extrabold text-emerald-300">
              {balance !== undefined ? formatNaira(balance) : "-"}
            </div>
          </div>

          <p className="mt-6 text-xs font-semibold tracking-[0.3em] text-amber-300">
            {greeting(hour)}, {player.display_name.toUpperCase()}
          </p>
          <h1 className="mt-1 text-5xl font-black tracking-tight">{formatClock(hour)}</h1>
          <p className="mt-1 text-sm text-zinc-300">
            {world.weekday} · Day {world.dayNumber}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
            New campus day in
            <span className="font-bold text-white">
              <Countdown target={world.nextDayAt}>
                <RefreshButton>Start the new day</RefreshButton>
              </Countdown>
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto mt-5 max-w-md space-y-4 px-5">
        <div
          className="flex items-center gap-4 rounded-2xl border border-white/10 p-4"
          style={{
            background: `linear-gradient(135deg, ${enrollment.universities.primary_color}, #0b1020)`,
          }}
        >
          <UniversityCrest
            shortName={enrollment.universities.short_name}
            primary={enrollment.universities.primary_color}
            secondary={enrollment.universities.secondary_color}
            className="h-14 w-12 shrink-0"
          />
          <div>
            <p className="text-xs text-zinc-300">{enrollment.level_year}00 Level</p>
            <p className="font-bold leading-tight">{enrollment.courses.name}</p>
            <p className="text-xs text-zinc-300">{enrollment.universities.name}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
          <span>📍 {state.locations?.name ?? "On campus"}</span>
          <span className="font-semibold text-amber-300">
            {state.hours_left} hours left today
          </span>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <Meter label="Energy" icon="⚡" value={state.energy} color="#fbbf24" />
          <Meter label="Health" icon="❤️" value={state.health} color="#f87171" />
          <Meter label="Happiness" icon="😊" value={state.happiness} color="#e879f9" />
        </div>

        <Link
          href="/campus"
          className="block rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-center text-base font-extrabold text-black active:scale-95"
        >
          Open campus map
        </Link>

        <p className="text-center text-xs text-zinc-500">
          Activities arrive in the next update. Lectures and your timetable come with
          academics.
        </p>

        <form action="/auth/signout" method="post" className="pt-2 text-center">
          <button
            type="submit"
            className="rounded-xl border border-white/20 px-5 py-2 text-sm text-zinc-300 hover:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}